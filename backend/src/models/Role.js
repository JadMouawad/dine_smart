// Base schema definition for the roles table
const Role = {
  table: "roles",
  columns: {
    id: "id",
    name: "name",
    createdAt: "created_at",
    updatedAt: "updated_at"
  },
  allowed: ["user", "owner", "admin"]
};

module.exports = Role;
