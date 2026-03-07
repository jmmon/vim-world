import basic from "./basic";
import sharedValidators from "~/simulation/shared/validators";

const serverValidators = {
    basic,
    ...sharedValidators,
};

export default serverValidators;


