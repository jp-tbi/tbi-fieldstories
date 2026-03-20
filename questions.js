module.exports = [
  {
    id: "your_name",
    label: "Your Name",
    type: "text",
    required: true,
  },
  {
    id: "your_shortname",
    label: "Your Shortname",
    type: "text",
    required: true,
  },
  {
    id: "store_number_location",
    label: "Store Number and Location (City & State/Province)",
    type: "text",
    required: true,
  },
  {
    id: "story_category",
    label: "Which category best fits your story?",
    type: "select",
    required: true,
    options: [
      "Weddings",
      "Hyperlocal / Community Impact",
      "Military",
      "Schools / Students",
      "New Store Opening",
      "Extraordinary Customer Service",
      "Other",
    ],
  },
  {
    id: "story_details",
    label: "Tell us your story. What happened? (2-4 sentences is perfect.)",
    type: "textarea",
    required: true,
  },
  {
    id: "who_was_involved",
    label:
      "Who was involved? (Associates, managers, customers, community partners, etc.)",
    type: "textarea",
    required: true,
  },
  {
    id: "why_meaningful",
    label:
      "Why was this moment meaningful or impactful? (What made it special for the customer, community, or team?)",
    type: "textarea",
    required: true,
  },
  {
    id: "photo_permission",
    label: "Do you have a photo we can include?",
    type: "radio",
    required: true,
    options: ["Yes - I will upload it", "No"],
  },
];
