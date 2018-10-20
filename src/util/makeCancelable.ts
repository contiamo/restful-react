export type CancelablePromise<T> = {
  cancel: () => void;
  isCancelled: () => boolean;
  promise: Promise<T>;
}

const makeCancelable = (promise: Promise<any>): CancelablePromise<any> => {
  let isCancelled = false;
  return {
    cancel() {
      isCancelled = true;
    },
    isCancelled() {
      return isCancelled;
    },
    promise: promise.then(
      (value: any): Promise<any> => (isCancelled ? Promise.reject({ isCancelled }) : Promise.resolve(value)),
    ),
  };
};

export default makeCancelable;
