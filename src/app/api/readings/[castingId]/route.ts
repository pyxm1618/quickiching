// The base reading endpoint exposes status only. Generation remains POST-only
// on /preview, so no question or provider input can enter through this path.
export { GET } from "./preview/route";
