export function compose_event_processor(...functions) {
    return (event, hint) => functions.reduceRight((acc, func) => func(acc, hint), event);
}