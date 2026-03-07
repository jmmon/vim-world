import interact, { interact2 } from "./interact";
import validateMove from "./move";

const sharedValidators = {
    interact,
    interact2,
    move: validateMove,
};

export default sharedValidators;


