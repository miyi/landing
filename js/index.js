export const loadCards = () => {
  const directives = {
    title: "directives",
    text: "Manipulate the DOM directly from html with dagger defined attributes.",
  };
  const dataBinding = {
    title: "data binding",
    text: "Manipulate state data directly as plain javascript objects.",
  };
  const modules = {
    title: "native modules",
    text: "No more webpack! Achieve performant module abstractions you can understand.",
  };
  const routing = {
    title: "native routing",
    text: "Dagger ships with its own routing! Flexible and concise.",
  };

  return {
    cards: [directives, dataBinding, modules, routing],
  };
};
