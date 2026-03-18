import dotenv from "dotenv";
dotenv.config();

export const SITE_ID = () => (process.env.SHAREPOINT_SITE_ID ?? "").trim();

export const LIST_IDS = {
  menus:              "0b40de28-1934-449b-9231-9742c2ff5480",
  recetas:            "d61b3758-2551-445b-8afa-c76546180c74",
  ingredientes:       "093ef085-2302-4a70-a31c-17b7c2abf2dc",
  ingredientesReceta: "074edc13-30b9-4376-9ac3-080f4be95a3f",
  gestionComidas:     "f8ee85f8-6060-4739-bac7-bb76fe117ead",
  usuarios:           "a3f16394-dd84-417e-8e0c-f5b14897e6e1",
};

const listIdCache = new Map<string, string>();

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getGraphToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }
  const body = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     process.env.AZURE_CLIENT_ID!,
    client_secret: process.env.AZURE_CLIENT_SECRET!,
    scope:         "https://graph.microsoft.com/.default",
  });
  const resp = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() }
  );
  if (!resp.ok) throw new Error(`Token fetch failed: ${resp.statusText}`);
  const data = await resp.json() as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

export async function fetchAllListItems(listId: string, selectFields: string, filter?: string): Promise<any[]> {
  const token = await getGraphToken();
  const items: any[] = [];
  let url: string | null =
    `https://graph.microsoft.com/v1.0/sites/${SITE_ID()}/lists/${listId}/items` +
    `?expand=fields(select=${selectFields})&$top=999` +
    (filter ? `&$filter=${encodeURIComponent(filter)}` : "");

  while (url) {
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
      },
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Graph API error ${resp.status}: ${err}`);
    }
    const data = await resp.json() as { value: any[]; "@odata.nextLink"?: string };
    items.push(...data.value.map((item: any) => item.fields));
    url = data["@odata.nextLink"] ?? null;
  }
  return items;
}

export async function getListIdByName(listName: string): Promise<string> {
  const cached = listIdCache.get(listName);
  if (cached) return cached;

  const token = await getGraphToken();
  const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID()}/lists?$filter=${encodeURIComponent(`displayName eq '${listName}'`)}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
    },
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Graph lists lookup error ${resp.status}: ${err}`);
  }

  const data = await resp.json() as { value?: Array<{ id: string; displayName: string }> };
  const match = data.value?.find((item) => item.displayName === listName);
  if (!match?.id) {
    throw new Error(`No se encontro la lista ${listName} en SharePoint`);
  }

  listIdCache.set(listName, match.id);
  return match.id;
}
