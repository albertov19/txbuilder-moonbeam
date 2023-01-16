const { ApiPromise, WsProvider } = require("@polkadot/api");

export async function subProvider(network) {
  const chains = {
    moonbase: {
      ws: "wss://moonbase-alpha.blastapi.io/1149fdef-ff34-48c0-9be4-7d81cb673a08",
    },
    moonriver: {
      ws: "wss://moonriver.blastapi.io/1149fdef-ff34-48c0-9be4-7d81cb673a08",
    },
    moonbeam: {
      ws: "wss://moonbeam.blastapi.io/1149fdef-ff34-48c0-9be4-7d81cb673a08",
    },
  };

  if (typeof ethereum !== "undefined") {
    // Create WS Provider
    const wsProvider = new WsProvider(chains[network].ws);

    // Wait for Provider
    const api = await ApiPromise.create({
      provider: wsProvider,
    });
    await api.isReady;

    return api;
  }
}
