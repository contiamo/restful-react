export const processResponse = async (response: Response) => {
  if ((response.headers.get("content-type") || "").includes("application/json")) {
    try {
      return {
        data: await response.json(),
        isError: false,
      };
    } catch (e) {
      return {
        data: e.message,
        isError: true,
      };
    }
  } else {
    return {
      data: await response.text(),
      isError: false,
    };
  }
};
