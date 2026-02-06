// Base schema definition for the users table
const User = {
  table: "users",
  columns: {
    id: "id",
    fullName: "full_name",
    email: "email",
    roleId: "role_id",
    createdAt: "created_at",
    updatedAt: "updated_at"
  },
  required: ["fullName", "email", "roleId"]
};

module.exports = User;
