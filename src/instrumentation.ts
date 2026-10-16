export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    (process.env.HTTP_PROXY || process.env.HTTPS_PROXY)
  ) {
    const { EnvHttpProxyAgent, setGlobalDispatcher } = await import("undici");
    setGlobalDispatcher(new EnvHttpProxyAgent());
  }
}
