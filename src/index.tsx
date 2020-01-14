import Get, { GetDataError, GetMethod, GetProps } from "./Get";

export { default as RestfulProvider } from "./Context";
export { default as Poll, PollProps } from "./Poll";
export { default as Mutate, MutateProps, MutateMethod } from "./Mutate";

export { useGet, UseGetProps, UseGetReturn } from "./useGet";
export { useMutate, UseMutateProps, UseMutateReturn } from "./useMutate";

export { Get, GetDataError, GetProps, GetMethod };

export default Get;
