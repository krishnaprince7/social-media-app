import { Router } from "express";

import { createAccount, updateProfile, login, getProfilePicture, getCurrentUser, getUserStatus, updatePrivacy, logout, updatePassword} from "../controler/users.controler.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { upload } from "../middlewares/upload.js";


const router = Router();

router.post("/register", createAccount);
router.post("/login", login);
router.post("/logout", verifyToken, logout); 
router.put("/update-password", verifyToken, updatePassword);
router.put("/update-profile", verifyToken, upload.single("profilePicture"), updateProfile);
router.get("/profile-picture", verifyToken, getProfilePicture);
router.get("/current-user", verifyToken, getCurrentUser);
router.get("/status/:id", getUserStatus);
router.patch("/privacy", verifyToken, updatePrivacy);


export default router;
