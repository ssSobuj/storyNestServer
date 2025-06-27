declare module "xss-clean" {
  const xss: () => express.RequestHandler;
  export default xss;
}
