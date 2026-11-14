import { IpcChannel, type MilestoneStatus, type ScientificVenue } from '../../src/types';
import type { ScientificVenueRepository } from '../database/ScientificVenueRepository';
import type { CommandRegistry } from './CommandRegistry';

type VenueInput = Omit<ScientificVenue, 'id' | 'created_at'>;

/**
 * Scientific agenda: venues (conferences, journals) and their milestones.
 *
 * Usage:
 *   registerAgendaCommands(commands, new ScientificVenueRepository(db.getDB()));
 */
export function registerAgendaCommands(commands: CommandRegistry, venues: ScientificVenueRepository): void {
  commands.add(IpcChannel.SCIENTIFIC_VENUES_GET_ALL, () => venues.getAllVenues());
  commands.add(IpcChannel.SCIENTIFIC_VENUE_CREATE, (venueData: VenueInput) => venues.createVenue(venueData));
  commands.add(IpcChannel.SCIENTIFIC_VENUE_UPDATE, ({ id, venueData }: { id: number; venueData: VenueInput }) =>
    venues.updateVenue(id, venueData),
  );
  commands.add(IpcChannel.SCIENTIFIC_VENUE_DELETE, (id: number) => venues.deleteVenue(id));
  commands.add(
    IpcChannel.SCIENTIFIC_MILESTONE_TOGGLE_STATUS,
    ({ milestoneId, status }: { milestoneId: number; status: MilestoneStatus }) =>
      venues.toggleMilestoneStatus(milestoneId, status),
  );
}
