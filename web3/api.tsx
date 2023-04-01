const { ApiPromise, WsProvider } = require('@polkadot/api');
declare let ethereum: any;

export async function subProvider(WsEndpoint) {
  if (typeof ethereum !== 'undefined') {
    // Create WS Provider
    const wsProvider = new WsProvider(WsEndpoint);

    // Wait for Provider
    const api = await ApiPromise.create({
      provider: wsProvider,
    });
    await api.isReady;

    return api;
  }
}
