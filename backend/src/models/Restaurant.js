// Base schema definition for the restaurants table
const Restaurant = {
  table: "restaurants",
  columns: {
    id: "id",
    name: "name",
    description: "description",
    address: "address",
    phone: "phone",
    ownerId: "owner_id",
    createdAt: "created_at",
    updatedAt: "updated_at"
  },
  required: ["name"]
};

module.exports = Restaurant;
