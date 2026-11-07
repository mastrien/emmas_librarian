import React, { useState, useEffect } from 'react';
import { useProjectService } from '../contexts/ServicesContext';
import { ScientificVenue, MilestoneStatus } from '../types';
import { ScientificAgendaView } from '../components/common/ScientificAgendaView';
import { VenueFormModal } from '../components/modals/VenueFormModal';
import { useDialogs } from '../components/common/dialogs/DialogProvider';

export const AgendaPage: React.FC = () => {
  const projectService = useProjectService();
  const { confirm } = useDialogs();
  const [venues, setVenues] = useState<ScientificVenue[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<ScientificVenue | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const loadVenues = async () => {
    try {
      const data = await projectService.getScientificVenues();
      setVenues(data || []);
    } catch (err) {
      console.error('Erro ao carregar eventos da agenda:', err);
    }
  };

  useEffect(() => {
    loadVenues();
  }, []);

  const handleOpenAddModal = (dateStr?: string) => {
    setSelectedVenue(null);
    setSelectedDate(dateStr || null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (venue: ScientificVenue) => {
    setSelectedVenue(venue);
    setSelectedDate(null);
    setIsModalOpen(true);
  };

  const handleSaveVenue = async (venueData: Omit<ScientificVenue, 'id' | 'created_at'>) => {
    try {
      if (selectedVenue) {
        await projectService.updateScientificVenue(selectedVenue.id, venueData);
      } else {
        await projectService.createScientificVenue(venueData);
      }
      setIsModalOpen(false);
      await loadVenues();
    } catch (err) {
      console.error('Erro ao salvar evento:', err);
    }
  };

  const handleDeleteVenue = async (id: number) => {
    const confirmed = await confirm({
      title: 'Excluir evento',
      message: 'O evento e todos os seus prazos serão excluídos.',
      confirmLabel: 'Excluir evento',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await projectService.deleteScientificVenue(id);
      await loadVenues();
    } catch (err) {
      console.error('Erro ao excluir evento:', err);
    }
  };

  const handleToggleMilestoneStatus = async (milestoneId: number, status: MilestoneStatus) => {
    try {
      return await projectService.toggleMilestoneStatus(milestoneId, status);
    } catch (err) {
      console.error('Erro ao alternar status do prazo:', err);
      return false;
    }
  };

  return (
    <div className="fade-in agenda-page">
      <ScientificAgendaView
        venues={venues}
        diarySet={new Set()}
        onAddVenue={handleOpenAddModal}
        onEditVenue={handleOpenEditModal}
        onDeleteVenue={handleDeleteVenue}
        onToggleMilestoneStatus={handleToggleMilestoneStatus}
      />

      <VenueFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveVenue}
        initialData={selectedVenue}
        initialDate={selectedDate}
      />
    </div>
  );
};
