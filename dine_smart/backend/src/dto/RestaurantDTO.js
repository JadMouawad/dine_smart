class RestaurantDTO {
  constructor(restaurant) {
    this.id = restaurant._id;
    this.name = restaurant.name;
    this.description = restaurant.description;
    this.cuisine = restaurant.cuisine;
    this.ownerId = restaurant.ownerId;
    this.address = restaurant.address;
    this.createdAt = restaurant.createdAt;
    this.updatedAt = restaurant.updatedAt;
  }
}

module.exports = RestaurantDTO;
