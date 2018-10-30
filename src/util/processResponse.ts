export const processResponse = async (response: Response) => {
  if ((response.headers.get("content-type") || "").includes("application/json")) {
    try {
      return {
        response,
        data: await response.json(),
        responseError: false,
      };
    } catch (e) {
      return {
        response,
        data: e.message,
        responseError: true,
      };
    }
  } else {
    return {
      response,
      data: await response.text(),
      responseError: false,
    };
  }
};
