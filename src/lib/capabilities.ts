export const CAPABILITIES = {
  container: ["20' standard", "40' standard", "40' high cube", "45' high cube", "Reefer", "Open top", "Flat rack", "ISO tank"],
  equipment: ["Tri-axle chassis", "Extendable chassis", "Side-loader", "Own chassis pool", "Gensets"],
  service: ["Import", "Export", "Live unload", "Drop and pick", "Yard storage", "Transload", "Overweight", "Hazmat", "Bonded / in-bond", "Weekend moves", "Prepull"],
} as const;

export type CapabilityCategory = keyof typeof CAPABILITIES;

export const CATEGORY_LABEL: Record<CapabilityCategory, string> = {
  container: "Container types",
  equipment: "Equipment",
  service: "Services",
};

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export const QUALIFICATION_LABEL = {
  unverified: "Not yet verified",
  in_review: "In review",
  verified: "Verified",
} as const;
