const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const controller = require("../controllers/restaurant.controller");

router.use(auth);
router.get("/", controller.list);
router.get("/:id", controller.getOne);

module.exports = router;
