module.exports = [
  {
    id: "your_name",
    label: { en: "Your Name", fr: "Votre nom" },
    type: "text",
    required: true,
  },
  {
    id: "your_shortname",
    label: { en: "Your Shortname", fr: "Votre nom court" },
    type: "text",
    required: true,
  },
  {
    id: "store_number_location",
    label: {
      en: "Store Number and Location (City & State/Province)",
      fr: "Numéro et emplacement du magasin (Ville et État/Province)",
    },
    type: "text",
    required: true,
  },
  {
    id: "story_category",
    label: {
      en: "Which category best fits your story?",
      fr: "Quelle catégorie correspond le mieux à votre histoire ?",
    },
    type: "select",
    required: true,
    options: [
      { value: "weddings", label: { en: "Weddings", fr: "Mariages" } },
      {
        value: "hyperlocal_community_impact",
        label: {
          en: "Hyperlocal / Community Impact",
          fr: "Impact hyperlocal / communautaire",
        },
      },
      { value: "military", label: { en: "Military", fr: "Militaire" } },
      {
        value: "schools_students",
        label: { en: "Schools / Students", fr: "Écoles / Élèves" },
      },
      {
        value: "new_store_opening",
        label: { en: "New Store Opening", fr: "Ouverture d'un nouveau magasin" },
      },
      {
        value: "extraordinary_customer_service",
        label: {
          en: "Extraordinary Customer Service",
          fr: "Service à la clientèle exceptionnel",
        },
      },
      { value: "other", label: { en: "Other", fr: "Autre" } },
    ],
  },
  {
    id: "story_details",
    label: {
      en: "Tell us your story. What happened? (2-4 sentences is perfect.)",
      fr: "Raconte-nous ton histoire. Qu'est-ce qui s'est passé ? (2 à 4 phrases, c'est parfait.)",
    },
    type: "textarea",
    required: true,
  },
  {
    id: "who_was_involved",
    label: {
      en: "Who was involved? (Associates, managers, customers, community partners, etc.)",
      fr: "Qui était impliqué ? (Collaborateurs, gestionnaires, clients, partenaires communautaires, etc.)",
    },
    type: "textarea",
    required: true,
  },
  {
    id: "why_meaningful",
    label: {
      en: "Why was this moment meaningful or impactful? (What made it special for the customer, community, or team?)",
      fr: "Pourquoi ce moment était-il significatif ou marquant ? (Qu'est-ce qui l'a rendu spécial pour le client, la communauté ou l'équipe?)",
    },
    type: "textarea",
    required: true,
  },
  {
    id: "photo_permission",
    label: {
      en: "Do you have a photo we can include?",
      fr: "Avez-vous une photo qu'on pourrait inclure ?",
    },
    type: "radio",
    required: true,
    options: [
      {
        value: "yes_upload",
        label: { en: "Yes - I will upload it", fr: "Oui, je vais le télécharger." },
      },
      { value: "no", label: { en: "No", fr: "Non" } },
    ],
  },
];
