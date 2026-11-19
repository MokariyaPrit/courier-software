import { Customer } from '../../entities/customer.entity';
import { Receiver } from '../../entities/receiver.entity';

/** Resolve display city/state from FK relations (text columns removed). */
export function locationNames(
  row:
    | Pick<Customer, 'cityRef' | 'stateRef'>
    | Pick<Receiver, 'cityRef' | 'stateRef'>
    | null
    | undefined,
) {
  return {
    city: row?.cityRef?.name ?? null,
    state: row?.stateRef?.name ?? null,
  };
}
