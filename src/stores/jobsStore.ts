import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Job, JobType, JobStatus, JobPhoto, Material, Signature, ChecklistItem } from '../types';

interface JobsState {
  jobs: Job[];
  
  // Actions
  addJob: (job: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'photos' | 'materials' | 'signatures' | 'checklistItems'> & { 
    photos?: JobPhoto[]; materials?: Material[]; signatures?: Signature[]; checklistItems?: ChecklistItem[];
  }) => Job;
  updateJob: (id: string, updates: Partial<Job>) => void;
  deleteJob: (id: string) => void;
  getJob: (id: string) => Job | undefined;
  
  // Photos
  addPhoto: (jobId: string, photo: Omit<JobPhoto, 'id' | 'jobId'>) => void;
  removePhoto: (jobId: string, photoId: string) => void;
  
  // Materials
  addMaterial: (jobId: string, material: Omit<Material, 'id'>) => void;
  updateMaterial: (jobId: string, materialId: string, updates: Partial<Material>) => void;
  removeMaterial: (jobId: string, materialId: string) => void;
  
  // Signatures
  addSignature: (jobId: string, signature: Omit<Signature, 'id' | 'jobId'>) => void;
  
  // Checklist
  toggleChecklistItem: (jobId: string, itemId: string) => void;
  addChecklistItem: (jobId: string, label: string) => void;
  
  // Filters
  getActiveJobs: () => Job[];
  getCompletedJobs: () => Job[];
  getJobsByType: (type: JobType) => Job[];
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useJobsStore = create<JobsState>()(
  persist(
    (set, get) => ({
      jobs: [],

      addJob: (jobData) => {
        const now = new Date().toISOString();
        const newJob: Job = {
          ...jobData,
          id: generateId(),
          photos: jobData.photos || [],
          materials: jobData.materials || [],
          signatures: jobData.signatures || [],
          checklistItems: jobData.checklistItems || [],
          createdAt: now,
          updatedAt: now,
        };
        set(state => ({ jobs: [newJob, ...state.jobs] }));
        return newJob;
      },

      updateJob: (id, updates) => {
        set(state => ({
          jobs: state.jobs.map(job =>
            job.id === id
              ? { ...job, ...updates, updatedAt: new Date().toISOString() }
              : job
          ),
        }));
      },

      deleteJob: (id) => {
        set(state => ({ jobs: state.jobs.filter(job => job.id !== id) }));
      },

      getJob: (id) => {
        return get().jobs.find(job => job.id === id);
      },

      // Photos
      addPhoto: (jobId, photo) => {
        const newPhoto: JobPhoto = {
          ...photo,
          id: generateId(),
          jobId,
        };
        set(state => ({
          jobs: state.jobs.map(job =>
            job.id === jobId
              ? { ...job, photos: [...job.photos, newPhoto], updatedAt: new Date().toISOString() }
              : job
          ),
        }));
      },

      removePhoto: (jobId, photoId) => {
        set(state => ({
          jobs: state.jobs.map(job =>
            job.id === jobId
              ? { ...job, photos: job.photos.filter(p => p.id !== photoId), updatedAt: new Date().toISOString() }
              : job
          ),
        }));
      },

      // Materials
      addMaterial: (jobId, material) => {
        const newMaterial: Material = {
          ...material,
          id: generateId(),
        };
        set(state => ({
          jobs: state.jobs.map(job =>
            job.id === jobId
              ? { ...job, materials: [...job.materials, newMaterial], updatedAt: new Date().toISOString() }
              : job
          ),
        }));
      },

      updateMaterial: (jobId, materialId, updates) => {
        set(state => ({
          jobs: state.jobs.map(job =>
            job.id === jobId
              ? {
                  ...job,
                  materials: job.materials.map(m =>
                    m.id === materialId ? { ...m, ...updates } : m
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : job
          ),
        }));
      },

      removeMaterial: (jobId, materialId) => {
        set(state => ({
          jobs: state.jobs.map(job =>
            job.id === jobId
              ? { ...job, materials: job.materials.filter(m => m.id !== materialId), updatedAt: new Date().toISOString() }
              : job
          ),
        }));
      },

      // Signatures
      addSignature: (jobId, signature) => {
        const newSig: Signature = {
          ...signature,
          id: generateId(),
          jobId,
        };
        set(state => ({
          jobs: state.jobs.map(job =>
            job.id === jobId
              ? { ...job, signatures: [...job.signatures, newSig], updatedAt: new Date().toISOString() }
              : job
          ),
        }));
      },

      // Checklist
      toggleChecklistItem: (jobId, itemId) => {
        set(state => ({
          jobs: state.jobs.map(job =>
            job.id === jobId
              ? {
                  ...job,
                  checklistItems: job.checklistItems.map(item =>
                    item.id === itemId
                      ? { ...item, completed: !item.completed, completedAt: !item.completed ? new Date().toISOString() : undefined }
                      : item
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : job
          ),
        }));
      },

      addChecklistItem: (jobId, label) => {
        const newItem: ChecklistItem = {
          id: generateId(),
          label,
          completed: false,
        };
        set(state => ({
          jobs: state.jobs.map(job =>
            job.id === jobId
              ? { ...job, checklistItems: [...job.checklistItems, newItem], updatedAt: new Date().toISOString() }
              : job
          ),
        }));
      },

      // Filters
      getActiveJobs: () => {
        return get().jobs.filter(j => j.status === 'active' || j.status === 'in_progress');
      },

      getCompletedJobs: () => {
        return get().jobs.filter(j => j.status === 'completed');
      },

      getJobsByType: (type) => {
        return get().jobs.filter(j => j.jobType === type);
      },
    }),
    {
      name: 'fieldsync-jobs',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
