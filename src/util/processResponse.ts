export const processResponse = (response: Response) => {
  if ((response.headers.get("content-type") || "").includes("application/json")) {
    return response.json();
  } else {
    return response.text();
  }
};
