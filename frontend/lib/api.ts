export async function readResponse(response: Response) {
  let data;
  try { data = await response.json(); }
  catch { throw new Error("The server returned an unreadable response. Please retry; your open scan is still available."); }
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "This request could not be completed. Please retry.");
  return data;
}
