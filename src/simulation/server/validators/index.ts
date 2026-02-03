import move from "./move";
import basic from "./basic";
import sharedValidators from "~/simulation/shared/validators";

const serverValidators = {
    move,
    basic,
    ...sharedValidators,
};

export default serverValidators;


