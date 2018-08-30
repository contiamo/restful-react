/**
 * Normalizes the path by removing leading slashes.
 *
 */
export default function sanitizeUrlPath(url: string): string {
  const [start, end] = [
    url.charAt(0) === "/" ? 1 : 0,
    url.charAt(url.length - 1) === "/" ? url.length - 1 : url.length,
  ];

  return url.substring(start, end);
}
