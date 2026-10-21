export function browserClient() {
  const channel = {
    on() {
      return channel;
    },
    subscribe() {
      return channel;
    },
  };
  return {
    channel: () => channel,
    removeChannel: () => Promise.resolve(),
    auth: {
      getUser: async () => ({
        data: { user: { id: "10000000-0000-4000-8000-000000000001" } },
        error: null,
      }),
    },
  };
}
