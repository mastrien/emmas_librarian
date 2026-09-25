import { IpcChannel, type MilestoneStatus, type ScientificVenue } from '../../types';
import type { ScientificVenueRepository } from '../../database/ScientificVenueRepository';
import { handle, type IpcRegistrar } from './handle';

type VenueInput = Omit<ScientificVenue, 'id' | 'created_at'>;

/**
 * Scientific agenda: venues (conferences, journals) and their milestones.
 *
 * Usage:
 *   registerAgendaHandlers(ipcMain, new ScientificVenueRepository(db.getDB()));
 */
export function registerAgendaHandlers(ipc: IpcRegistrar, venues: ScientificVenueRepository): void {
  handle(ipc, IpcChannel.SCIENTIFIC_VENUES_GET_ALL, () => venues.getAllVenues());
  handle(ipc, IpcChannel.SCIENTIFIC_VENUE_CREATE, (_e, venueData: VenueInput) => venues.createVenue(venueData));
  handle(ipc, IpcChannel.SCIENTIFIC_VENUE_UPDATE, (_e, { id, venueData }: { id: number; venueData: VenueInput }) =>
    venues.updateVenue(id, venueData),
  );
  handle(ipc, IpcChannel.SCIENTIFIC_VENUE_DELETE, (_e, id: number) => venues.deleteVenue(id));
  handle(
    ipc,
    IpcChannel.SCIENTIFIC_MILESTONE_TOGGLE_STATUS,
    (_e, { milestoneId, status }: { milestoneId: number; status: MilestoneStatus }) =>
      venues.toggleMilestoneStatus(milestoneId, status),
  );
}
