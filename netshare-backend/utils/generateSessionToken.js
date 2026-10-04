import crypto from "crypto";

const generateSessionToken = () => {
  return crypto.randomBytes(24).toString("hex");
};

export default generateSessionToken;