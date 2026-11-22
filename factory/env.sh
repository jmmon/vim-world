FACTORY_SPEC_MODEL="${FACTORY_SPEC_MODEL:-halo/flash-next}"
FACTORY_TESTER_MODEL="${FACTORY_TESTER_MODEL:-halo/flash-next}"
FACTORY_BUILDER_MODEL="${FACTORY_BUILDER_MODEL:-halo/flash-next}"
FACTORY_QA_MODEL="${FACTORY_QA_MODEL:-halo/flash-next}"
FACTORY_REVIEWER_MODEL="${FACTORY_REVIEWER_MODEL:-halo/flash-next}"
# Spec review defaults to the reviewer lineage, not the spec author's, so the
# reviewer is a different model than the one that wrote the spec.
FACTORY_SPEC_REVIEW_MODEL="${FACTORY_SPEC_REVIEW_MODEL:-$FACTORY_REVIEWER_MODEL}"
FACTORY_RETRO_MODEL="${FACTORY_RETRO_MODEL:-halo/flash-next}"
FACTORY_AGENT_TIMEOUT="${FACTORY_AGENT_TIMEOUT:-1800}"
FACTORY_GATE_TIMEOUT="${FACTORY_GATE_TIMEOUT:-900}"
