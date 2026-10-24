// Photos from Unsplash (free to use under the Unsplash License). Swap any ID here to change a photo.
const u = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&q=70`;

export const PHOTOS = {
  hero: { src: u("photo-1590497008432-598f04441de8"), alt: "Container port with stacked containers and ship-to-shore cranes under a heavy sky" },
  forwarders: { src: u("photo-1741173337736-0c6cd956a9b3"), alt: "Crane loading cargo containers onto a ship" },
  carriers: { src: u("photo-1700716465891-9e5e9f501d7d"), alt: "Truck parked in front of rows of shipping containers" },
  yard: { src: u("photo-1634646809203-f3b4adff9127"), alt: "Shipping containers stacked high in a terminal yard" },
  auth: { src: u("photo-1759272840538-ae4b07214c71"), alt: "Shipping containers stacked at a port at sunset" },
  driver: { src: u("photo-1716880288871-c15d8519f5b3"), alt: "Semi truck parked next to a shipping container" },
};
