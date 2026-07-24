import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Flame, Plus, Trash2, Eye, Edit3, X, Sparkles, Send, Compass, Lock, Link as LinkIcon, Upload, ExternalLink, RefreshCw, Search, FileText, Video, Image as ImageIcon, UploadCloud, Download, LogOut, Filter, Users, Globe, Info
} from 'lucide-react';
import { Profile, IncentiveCycle, Goal, Proof } from '../types';
import { 
  DEPARTMENTS, SMILEYS, getSmileyForPercentage 
} from '../data';

const isWebUrl = (proof?: Proof | null): boolean => {
  if (!proof || !proof.external_url) return false;
  if (proof.external_url.startsWith('data:')) return false;
  return (
    proof.external_url.startsWith('http://') ||
    proof.external_url.startsWith('https://') ||
    proof.external_url.startsWith('www.') ||
    proof.file_type === 'url' ||
    proof.file_type === 'link'
  );
};

const compressImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 900;
      const MAX_HEIGHT = 900;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let result = canvas.toDataURL('image/jpeg', 0.65);
        if (result.length > 500000) {
          const secondCanvas = document.createElement('canvas');
          secondCanvas.width = Math.round(width * 0.7);
          secondCanvas.height = Math.round(height * 0.7);
          const secondCtx = secondCanvas.getContext('2d');
          if (secondCtx) {
            secondCtx.drawImage(img, 0, 0, secondCanvas.width, secondCanvas.height);
            result = secondCanvas.toDataURL('image/jpeg', 0.5);
          }
        }
        resolve(result);
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = (err) => reject(err);
  });
};

const LOGIN_ID_KEY = 'aurora_logged_in_id';
const LOGIN_EMAIL_KEY = 'aurora_logged_in_email';

function resolveSessionProfile(profiles: Profile[]): Profile | null {
  const storedId = localStorage.getItem(LOGIN_ID_KEY);
  if (storedId) {
    const byId = profiles.find((p) => p.id === storedId);
    if (byId) return byId;
  }

  const storedEmail = localStorage.getItem(LOGIN_EMAIL_KEY);
  if (storedEmail) {
    return profiles.find((p) => p.email.toLowerCase() === storedEmail.toLowerCase()) || null;
  }

  return null;
}

const goalTypeBadgeClass = (goalType: string) =>
  goalType === 'personal'
    ? 'goal-type-personal'
    : 'goal-type-business';

export default function MyGoals() {
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [cycles, setCycles] = useState<IncentiveCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [allGoals, setAllGoals] = useState<Goal[]>([]);
  const [proofsMap, setProofsMap] = useState<Record<string, Proof[]>>({});
  
  // App-wide state
  const [activeEmployeeId, setActiveEmployeeId] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [showNoGoalsOnly, setShowNoGoalsOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'leaderboard' | 'workspace'>('leaderboard');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Database-backed cheers & login state
  const [allCheers, setAllCheers] = useState<any[]>([]);
  const [loggedInId, setLoggedInId] = useState<string>(() => {
    return localStorage.getItem(LOGIN_ID_KEY) || '';
  });
  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState('');

  // Simplified Create/Edit Goal form state
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [showTitleError, setShowTitleError] = useState(false);
  const [showDescriptionError, setShowDescriptionError] = useState(false);
  const [goalType, setGoalType] = useState<'personal' | 'business'>('personal');
  const [formSubmitLoading, setFormSubmitLoading] = useState(false);

  // Direct proof upload state
  const [uploadingProofForGoalId, setUploadingProofForGoalId] = useState<string | null>(null);
  const [proofExternalUrl, setProofExternalUrl] = useState('');
  const [proofFileName, setProofFileName] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [proofSubmitLoading, setProofSubmitLoading] = useState(false);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [selectedPreviewProof, setSelectedPreviewProof] = useState<Proof | null>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);

  const [proofToDelete, setProofToDelete] = useState<string | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);

  // Progress-advancing proof modal states
  const [showProgressProofModal, setShowProgressProofModal] = useState(false);
  const [progressProofGoal, setProgressProofGoal] = useState<Goal | null>(null);
  const [progressProofTargetPct, setProgressProofTargetPct] = useState<number>(0);
  const [progressProofTargetIndex, setProgressProofTargetIndex] = useState<number>(0);
  const [progressProofNote, setProgressProofNote] = useState('');
  const [progressProofExternalUrl, setProgressProofExternalUrl] = useState('');
  const [progressProofFileName, setProgressProofFileName] = useState('');
  const [progressProofFile, setProgressProofFile] = useState<File | null>(null);
  const [progressProofLoading, setProgressProofLoading] = useState(false);
  const [progressProofError, setProgressProofError] = useState('');
  const [proofModalTab, setProofModalTab] = useState<'upload' | 'link'>('upload');
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const renderError = (rawMsg: string, onClear: () => void) => {
    if (!rawMsg) return null;

    return (
      <div className="p-4 bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs rounded-xl space-y-3 animate-in fade-in font-sans shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-black uppercase tracking-wider border border-amber-500/30">
                Notice
              </span>
            </div>
            
            <div className="space-y-2 text-zinc-200 text-xs">
              <ul className="space-y-2 text-zinc-300 text-xs font-medium">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span><strong className="text-amber-300 font-bold">File is too big</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span><strong className="text-white">Try another file</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span><strong className="text-white">Try again</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span><strong className="text-amber-300 font-bold">Or put a link</strong></span>
                </li>
              </ul>
            </div>
          </div>
          
          <button 
            type="button" 
            onClick={onClear} 
            className="text-zinc-400 hover:text-white shrink-0 p-1.5 bg-zinc-900 rounded-lg border border-zinc-800 transition-colors cursor-pointer"
            title="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    initApp();
  }, []);

  useEffect(() => {
    if (selectedCycleId) {
      fetchGoalsAndProofs(selectedCycleId);
    }
  }, [selectedCycleId, profilesList]);

  // Re-bind session after DB re-seeds (profile IDs change; email stays stable)
  useEffect(() => {
    if (profilesList.length === 0) return;

    const sessionProfile = resolveSessionProfile(profilesList);
    if (sessionProfile) {
      setLoggedInId(sessionProfile.id);
      setActiveEmployeeId(sessionProfile.id);
      localStorage.setItem(LOGIN_ID_KEY, sessionProfile.id);
      localStorage.setItem(LOGIN_EMAIL_KEY, sessionProfile.email.toLowerCase());
      return;
    }

    if (loggedInId || localStorage.getItem(LOGIN_EMAIL_KEY)) {
      setLoggedInId('');
      setActiveEmployeeId('');
      localStorage.removeItem(LOGIN_ID_KEY);
      localStorage.removeItem(LOGIN_EMAIL_KEY);
    }
  }, [profilesList]);

  const fetchCheers = async () => {
    try {
      const { data, error } = await supabase.from('cheers').select('*');
      if (!error && data) {
        setAllCheers(data);
      }
    } catch (err) {
      console.error('Failed to fetch cheers:', err);
    }
  };

  const initApp = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { data: profilesData, error: profilesErr } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (profilesErr) throw profilesErr;
      
      const loadedProfiles = profilesData || [];
      setProfilesList(loadedProfiles);

      const { data: cyclesData, error: cyclesErr } = await supabase
        .from('incentive_cycles')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (cyclesErr) throw cyclesErr;
      setCycles(cyclesData || []);

      if (cyclesData && cyclesData.length > 0) {
        const activeCycle = cyclesData.find(c => c.status === 'Active') || cyclesData[0];
        setSelectedCycleId(activeCycle.id);
        await fetchGoalsAndProofs(activeCycle.id, loadedProfiles);
      }

      await fetchCheers();
    } catch (err: any) {
      setErrorMsg(`Initialization Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchGoalsAndProofs = async (cycleId: string, currentProfiles: Profile[] = profilesList) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { data: goalsData, error: goalsErr } = await supabase
        .from('goals')
        .select('*')
        .eq('cycle_id', cycleId);

      if (goalsErr) throw goalsErr;
      let fetchedGoals = (goalsData || []) as Goal[];

      const activeProfiles = currentProfiles.length > 0 ? currentProfiles : profilesList;

      const goalsWithProfiles = fetchedGoals.map(g => {
        const profile = activeProfiles.find(p => p.id === g.employee_id);
        return { ...g, employee_profile: profile };
      });
      setAllGoals(goalsWithProfiles);

      const goalIds = fetchedGoals.map(g => g.id);
      if (goalIds.length > 0) {
        const { data: proofsData, error: proofsErr } = await supabase
          .from('proofs')
          .select('*')
          .in('goal_id', goalIds);

        if (!proofsErr && proofsData) {
          const pMap: Record<string, Proof[]> = {};
          for (const pr of proofsData) {
            if (!pMap[pr.goal_id]) pMap[pr.goal_id] = [];
            pMap[pr.goal_id].push(pr as Proof);
          }
          setProofsMap(pMap);
        }
      } else {
        setProofsMap({});
      }

      await fetchCheers();
    } catch (err: any) {
      setErrorMsg(`Failed to query goals: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateForm = (type: 'personal' | 'business', owner?: Profile | null) => {
    const profile = owner ?? resolveSessionProfile(profilesList);
    if (!profile) {
      setErrorMsg('Please sign in to create goals.');
      return;
    }
    setGoalType(type);
    setEditingGoal(null);
    setGoalTitle('');
    setGoalDescription('');
    setShowTitleError(false);
    setShowDescriptionError(false);
    setErrorMsg('');
    setSuccessMsg('');
    setShowGoalForm(true);
  };

  const handleOpenEditForm = (goal: Goal, owner?: Profile | null) => {
    const profile = owner ?? resolveSessionProfile(profilesList);
    if (!profile || goal.employee_id !== profile.id) {
      setErrorMsg("You cannot edit another teammate's goal.");
      return;
    }
    setEditingGoal(goal);
    setGoalType(goal.goal_type as 'personal' | 'business');
    setGoalTitle(goal.title);
    setGoalDescription(goal.description);
    setShowTitleError(false);
    setShowDescriptionError(false);
    setErrorMsg('');
    setSuccessMsg('');
    setShowGoalForm(true);
  };

  const handleSaveGoal = async () => {
    const title = goalTitle.trim();
    const description = goalDescription.trim();
    const missingTitle = !title;
    const missingDescription = !description;

    setShowTitleError(missingTitle);
    setShowDescriptionError(missingDescription);

    if (missingTitle || missingDescription) {
      setErrorMsg(missingDescription && title ? 'Add description' : 'Please complete the title and description.');
      return;
    }

    const sessionProfile = resolveSessionProfile(profilesList);
    if (!sessionProfile) {
      setErrorMsg('Please sign in to save goals.');
      return;
    }

    setFormSubmitLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const activeCycle = cycles.find(c => c.id === selectedCycleId);
      const targetEndDate = activeCycle ? activeCycle.end_date : '2026-07-31';

      const serializedSuccess = JSON.stringify({
        type: 'percentage',
        target: 100,
        current: editingGoal ? editingGoal.progress_percentage : 0,
        text: 'Self-tracked via emojis'
      });

      const goalData = {
        employee_id: sessionProfile.id,
        cycle_id: selectedCycleId,
        goal_type: goalType,
        title,
        description,
        success_criteria: serializedSuccess,
        beyond_bau_explanation: null,
        target_date: targetEndDate,
        progress_percentage: editingGoal ? editingGoal.progress_percentage : 0,
        status: 'Approved',
        updated_at: new Date().toISOString()
      };

      if (editingGoal) {
        const { error } = await supabase
          .from('goals')
          .update(goalData)
          .eq('id', editingGoal.id);

        if (error) throw error;
        setSuccessMsg('Goal updated successfully!');
      } else {
        const { error } = await supabase
          .from('goals')
          .insert({
            ...goalData,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
        setSuccessMsg('New goal created successfully!');
      }

      fetchGoalsAndProofs(selectedCycleId);
      setTimeout(() => {
        setShowGoalForm(false);
        setEditingGoal(null);
      }, 600);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save goal.');
    } finally {
      setFormSubmitLoading(false);
    }
  };

  const handleDeleteGoal = (goalId: string) => {
    setGoalToDelete(goalId);
  };

  const executeDeleteGoal = async (goalId: string) => {
    const targetGoal = allGoals.find(g => g.id === goalId);
    const sessionProfile = resolveSessionProfile(profilesList);
    if (targetGoal && sessionProfile && targetGoal.employee_id !== sessionProfile.id) {
      setErrorMsg("You cannot delete another teammate's goal.");
      return;
    }
    setGoalToDelete(null);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      // First delete any associated proofs to avoid foreign-key constraint violations
      await supabase
        .from('proofs')
        .delete()
        .eq('goal_id', goalId);

      // Then delete the goal itself
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', goalId);

      if (error) throw error;
      setSuccessMsg('Goal removed successfully.');
      fetchGoalsAndProofs(selectedCycleId);
    } catch (err: any) {
      setErrorMsg(`Deletion Failed: ${err.message}`);
    }
  };

  const handleDeleteProof = (proofId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProofToDelete(proofId);
  };

  const executeDeleteProof = async (proofId: string) => {
    setProofToDelete(null);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { error } = await supabase
        .from('proofs')
        .delete()
        .eq('id', proofId);

      if (error) throw error;
      setSuccessMsg('Proof deleted successfully.');
      setSelectedPreviewProof(null);
      fetchGoalsAndProofs(selectedCycleId);
    } catch (err: any) {
      setErrorMsg(`Failed to delete proof: ${err.message}`);
    }
  };

  const handleSmileyClick = async (goal: Goal, smileyIndex: number, owner?: Profile | null) => {
    const profile = owner ?? resolveSessionProfile(profilesList);
    if (!profile || goal.employee_id !== profile.id) {
      setErrorMsg("You cannot edit another teammate's goal.");
      return;
    }
    const percentageMap = [0, 25, 50, 75, 100];
    const newProgressPct = percentageMap[smileyIndex];

    setErrorMsg('');
    setSuccessMsg('');

    // If moving progress further, a verification proof is mandatory
    if (newProgressPct > goal.progress_percentage) {
      setProgressProofGoal(goal);
      setProgressProofTargetPct(newProgressPct);
      setProgressProofTargetIndex(smileyIndex);
      setProgressProofNote(`Progress milestone: ${newProgressPct}% reached.`);
      setProgressProofExternalUrl('');
      setProgressProofFileName('');
      setProgressProofFile(null);
      setProgressProofError('');
      setProofModalTab('upload');
      setShowProgressProofModal(true);
      return;
    }

    try {
      const serializedSuccess = JSON.stringify({
        type: 'percentage',
        target: 100,
        current: newProgressPct,
        text: 'Self-tracked via emojis'
      });

      const { error } = await supabase
        .from('goals')
        .update({
          progress_percentage: newProgressPct,
          success_criteria: serializedSuccess,
          status: newProgressPct === 100 ? 'Achieved' : 'Approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', goal.id);

      if (error) throw error;
      fetchGoalsAndProofs(selectedCycleId);
    } catch (err: any) {
      setErrorMsg(`Progress sync failed: ${err.message}`);
    }
  };

  const handleProgressProofSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!progressProofGoal) return;

    if (proofModalTab === 'upload' && !progressProofFile) {
      setProgressProofError('Please drop or select a proof file.');
      return;
    }

    if (proofModalTab === 'link' && !progressProofExternalUrl.trim()) {
      setProgressProofError('Please enter a valid external link URL.');
      return;
    }

    setProgressProofLoading(true);
    setProgressProofError('');

    try {
      let finalUrl = progressProofExternalUrl.trim() || null;
      let finalFileName = progressProofFileName.trim() || 'Verification Link';
      let finalFileType = 'link';
      let finalFileSize = 0;

      if (proofModalTab === 'upload' && progressProofFile) {
        if (progressProofFile.type.startsWith('image/') && progressProofFile.size > 5 * 1024 * 1024) {
          setProgressProofError('Image file exceeds the 5 MB limit. Please select a smaller image or switch to the "Attach Link" tab.');
          setProgressProofLoading(false);
          return;
        }

        if ((progressProofFile.type.startsWith('video/') || progressProofFile.type === 'application/pdf') && progressProofFile.size > 500 * 1024) {
          setProgressProofError('Direct Video/PDF upload limit is 500 KB. For larger videos or PDFs, please switch to the "Attach Link" tab to attach a link (Google Drive, Loom, YouTube, Figma, Dropbox, etc.).');
          setProgressProofLoading(false);
          return;
        }

        finalFileName = progressProofFile.name;
        finalFileType = progressProofFile.type;
        finalFileSize = progressProofFile.size;

        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const rawData = event.target?.result as string;
            let finalData = rawData;
            if (progressProofFile.type.startsWith('image/')) {
              try {
                finalData = await compressImage(rawData);
              } catch (err) {
                console.warn('Compression failed, using raw data', err);
              }
            }
            resolve(finalData);
          };
          reader.onerror = () => reject(new Error('Error reading file'));
          reader.readAsDataURL(progressProofFile);
        });

        if (base64Data.length > 700000) {
          setProgressProofError('File payload is too large for database storage (exceeds ~500KB limit). Please upload a smaller screenshot or attach a URL link (Google Drive, Loom, Figma, etc.) under the "Attach Link" tab.');
          setProgressProofLoading(false);
          return;
        }

        finalUrl = base64Data;
      }

      const uploaderId = resolveSessionProfile(profilesList)?.id;
      if (!uploaderId) throw new Error('Please sign in to upload proofs.');

      // 1. Insert proof
      const { error: proofErr } = await supabase
        .from('proofs')
        .insert({
          goal_id: progressProofGoal.id,
          uploaded_by: uploaderId,
          external_url: finalUrl,
          file_name: finalFileName,
          file_type: finalFileType,
          file_size: finalFileSize,
          note: progressProofNote.trim() || `Uploaded proof to advance progress to ${progressProofTargetPct}%.`,
          created_at: new Date().toISOString()
        });

      if (proofErr) throw proofErr;

      // 2. Update goal progress
      const serializedSuccess = JSON.stringify({
        type: 'percentage',
        target: 100,
        current: progressProofTargetPct,
        text: 'Self-tracked via emojis'
      });

      const { error: goalErr } = await supabase
        .from('goals')
        .update({
          progress_percentage: progressProofTargetPct,
          success_criteria: serializedSuccess,
          status: progressProofTargetPct === 100 ? 'Achieved' : 'Approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', progressProofGoal.id);

      if (goalErr) throw goalErr;

      setSuccessMsg(`Proof uploaded successfully and progress advanced to ${progressProofTargetPct}%!`);
      setShowProgressProofModal(false);
      setProgressProofGoal(null);
      setProgressProofTargetPct(0);
      setProgressProofTargetIndex(0);
      setProgressProofNote('');
      setProgressProofExternalUrl('');
      setProgressProofFileName('');
      setProgressProofFile(null);
      fetchGoalsAndProofs(selectedCycleId);
    } catch (err: any) {
      setProgressProofError(`Failed to save proof & advance progress: ${err.message}`);
    } finally {
      setProgressProofLoading(false);
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadingProofForGoalId) return;

    if (!proofExternalUrl.trim() && !proofFileName.trim()) {
      setErrorMsg('Please specify a URL link or file name reference.');
      return;
    }

    setProofSubmitLoading(true);
    setErrorMsg('');
    try {
      const uploaderId = resolveSessionProfile(profilesList)?.id;
      if (!uploaderId) throw new Error('Please sign in to upload proofs.');

      const { error } = await supabase
        .from('proofs')
        .insert({
          goal_id: uploadingProofForGoalId,
          uploaded_by: uploaderId,
          external_url: proofExternalUrl.trim() || null,
          file_name: proofFileName.trim() || 'Verification file',
          note: proofNote.trim() || 'Uploaded development work verification.',
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      
      setSuccessMsg('Proof logged successfully!');
      setProofExternalUrl('');
      setProofFileName('');
      setProofNote('');
      setUploadingProofForGoalId(null);
      fetchGoalsAndProofs(selectedCycleId);
    } catch (err: any) {
      setErrorMsg(`Upload failed: ${err.message}`);
    } finally {
      setProofSubmitLoading(false);
    }
  };

  const handleFileDropOrSelect = async (file: File, goalId: string) => {
    const isAllowed = file.type.startsWith('image/') || file.type.startsWith('video/') || file.type === 'application/pdf';
    
    if (!isAllowed) {
      setErrorMsg('Invalid file type. Please upload an image, video, or PDF.');
      return;
    }

    if (file.type.startsWith('image/') && file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image file exceeds the 5 MB limit. Please select a smaller image or attach an external URL link.');
      return;
    }

    if ((file.type.startsWith('video/') || file.type === 'application/pdf') && file.size > 500 * 1024) {
      setErrorMsg('Direct Video/PDF upload limit is 500 KB. For larger videos or PDFs, please attach a link (Google Drive, Loom, YouTube, Figma, Dropbox, etc.).');
      return;
    }

    setProofSubmitLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawData = event.target?.result as string;
      
      let finalData = rawData;
      if (file.type.startsWith('image/')) {
        try {
          finalData = await compressImage(rawData);
        } catch (e) {
          console.warn("Failed to compress image, using original", e);
        }
      }

      if (finalData.length > 700000) {
        setErrorMsg('File payload is too large for database storage (exceeds ~500KB limit). Please upload a smaller screenshot or attach an external URL link instead.');
        setProofSubmitLoading(false);
        return;
      }

      try {
        const uploaderId = resolveSessionProfile(profilesList)?.id;
        if (!uploaderId) throw new Error('Please sign in to upload proofs.');

        const { error } = await supabase
          .from('proofs')
          .insert({
            goal_id: goalId,
            uploaded_by: uploaderId,
            external_url: finalData,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            note: `Uploaded proof file: ${file.name}`,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
        setSuccessMsg('Proof uploaded and logged successfully!');
        setUploadingProofForGoalId(null);
        fetchGoalsAndProofs(selectedCycleId);
      } catch (err: any) {
        setErrorMsg(`Failed to save proof: ${err.message}`);
      } finally {
        setProofSubmitLoading(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Error reading file.');
      setProofSubmitLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleCheerEmployee = async (receiverId: string) => {
    const sessionProfile = resolveSessionProfile(profilesList);
    if (!sessionProfile) {
      setErrorMsg('Please sign in with your email first to cheer teammates.');
      return;
    }

    try {
      // Find if we already cheered this person
      const existingCheer = allCheers.find(c => c.giver_id === sessionProfile.id && c.receiver_id === receiverId);

      if (existingCheer) {
        // Toggle off - delete from DB
        const { error } = await supabase
          .from('cheers')
          .delete()
          .eq('id', existingCheer.id);

        if (error) throw error;
      } else {
        // Toggle on - insert to DB
        const { error } = await supabase
          .from('cheers')
          .insert({
            giver_id: sessionProfile.id,
            receiver_id: receiverId,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
      }

      // Re-fetch cheers to update UI reactively
      await fetchCheers();
    } catch (err: any) {
      console.error('Cheer toggle failed:', err);
      setErrorMsg(`Failed to register cheer: ${err.message}`);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = loginEmail.trim().toLowerCase();
    const found = profilesList.find(p => p.email.toLowerCase() === normalized);

    if (found) {
      setLoggedInId(found.id);
      setActiveEmployeeId(found.id);
      localStorage.setItem(LOGIN_ID_KEY, found.id);
      localStorage.setItem(LOGIN_EMAIL_KEY, found.email.toLowerCase());
      setSuccessMsg(`Welcome back, ${found.full_name}!`);
      setLoginEmail('');
      setLoginError('');
    } else {
      setLoginError('Email not found in LearnApp employee roster.');
    }
  };

  const handleLogout = () => {
    setLoggedInId('');
    setActiveEmployeeId('');
    localStorage.removeItem(LOGIN_ID_KEY);
    localStorage.removeItem(LOGIN_EMAIL_KEY);
    setSuccessMsg('Logged out successfully.');
  };

  const canDeleteProof = (proof: Proof, goalEmployeeId?: string) => {
    const sessionProfile = resolveSessionProfile(profilesList);
    if (!sessionProfile) return false;
    if (sessionProfile.role === 'admin') return true;
    if (proof.uploaded_by === sessionProfile.id) return true;
    if (goalEmployeeId === sessionProfile.id) return true;
    return false;
  };

  const getCycleDisplayName = (cycleName: string) => {
    return cycleName.replace(/\s*Cycle\s*/gi, '').trim();
  };

  // Filter profiles based on selected department, no goals filter, and text search
  const filteredProfiles = profilesList.filter(p => {
    if (selectedDepartment !== 'All' && p.department !== selectedDepartment) return false;
    
    const pGoals = allGoals.filter(g => g.employee_id === p.id);
    if (showNoGoalsOnly && pGoals.length > 0) return false;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const nameMatch = p.full_name.toLowerCase().includes(query);
      const deptMatch = p.department.toLowerCase().includes(query);
      return nameMatch || deptMatch;
    }
    return true;
  });

  const noGoalsCount = profilesList.filter(p => {
    if (selectedDepartment !== 'All' && p.department !== selectedDepartment) return false;
    const pGoals = allGoals.filter(g => g.employee_id === p.id);
    return pGoals.length === 0;
  }).length;

  // Calculate average progress and gamified stamps for each profile, sorting by total stamps
  const sortedLeaderboard = [...filteredProfiles].map(p => {
    const pGoals = allGoals.filter(g => g.employee_id === p.id);
    
    // Business Goals Progress (0-100)
    const bGoals = pGoals.filter(g => g.goal_type === 'business');
    const bProgress = bGoals.length > 0 ? bGoals.reduce((sum, g) => sum + g.progress_percentage, 0) / bGoals.length : 0;
    
    // Personal Goals Progress (0-100)
    const persGoals = pGoals.filter(g => g.goal_type === 'personal');
    const pProgress = persGoals.length > 0 ? persGoals.reduce((sum, g) => sum + g.progress_percentage, 0) / persGoals.length : 0;

    // Relative contribution to total progress based on total goals count
    const businessContrib = pGoals.length > 0 
      ? (bGoals.reduce((sum, g) => sum + g.progress_percentage, 0) / pGoals.length) 
      : 0;

    const personalContrib = pGoals.length > 0 
      ? (persGoals.reduce((sum, g) => sum + g.progress_percentage, 0) / pGoals.length) 
      : 0;

    // Proofs Uploaded Progress (0-100)
    const proofPct = pGoals.length > 0 ? (pGoals.filter(g => proofsMap[g.id] && proofsMap[g.id].length > 0).length / pGoals.length) * 100 : 0;
    const proofContrib = 0;

    const calculatedProgress = Math.round(businessContrib + personalContrib);

    // Stamps (We can keep them as a visual score on the right)
    const businessStamps = (bProgress / 100) * 5;
    const personalStamps = (pProgress / 100) * 5;
    const empGoalIds = pGoals.map(g => g.id);
    const totalProofsCount = empGoalIds.reduce((sum, gid) => sum + (proofsMap[gid]?.length || 0), 0);
    const proofStamps = Math.min(5, totalProofsCount);
    
    const cheersCount = allCheers.filter(c => c.receiver_id === p.id).length;
    const bonusStamps = Math.min(5, cheersCount);
    const totalStamps = Number((businessStamps + personalStamps + proofStamps + bonusStamps).toFixed(1));

    return { 
      ...p, 
      avgProgress: calculatedProgress, 
      calculatedProgress,
      businessContrib,
      personalContrib,
      proofContrib,
      bProgress,
      pProgress,
      proofPct,
      goalsCount: pGoals.length, 
      goals: pGoals,
      businessStamps,
      personalStamps,
      proofStamps,
      bonusStamps,
      totalStamps,
      cheersCount
    };
  }).sort((a, b) => {
    if (b.calculatedProgress !== a.calculatedProgress) {
      return b.calculatedProgress - a.calculatedProgress;
    }
    return b.totalStamps - a.totalStamps;
  });

  const loggedInProfile = resolveSessionProfile(profilesList);
  const sessionUserId = loggedInProfile?.id || '';
  const workspaceGoals = sessionUserId
    ? allGoals.filter((g) => g.employee_id === sessionUserId)
    : [];
  const canEditGoals = !!loggedInProfile;

  if (loading && profilesList.length === 0) {
    return (
      <div className="min-h-screen bg-[#040406] text-[#ececf3] flex items-center justify-center p-4 font-sans">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-t-transparent border-[#00ff88] rounded-full animate-spin mx-auto" />
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Loading LearnApp roster...</p>
        </div>
      </div>
    );
  }

  if (!loggedInProfile) {
    return (
      <div className="min-h-screen bg-[#040406] text-[#ececf3] flex items-center justify-center p-4 relative font-sans">
        {/* Soft Elegant Blur Ambient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-sm bg-[#0e0e14] border border-zinc-900 rounded-3xl p-8 space-y-6 shadow-2xl relative z-10">
          
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00ff88] to-emerald-500 p-[1.5px] shadow-[0_0_20px_rgba(0,255,136,0.2)] mx-auto flex items-center justify-center">
              <div className="w-full h-full bg-[#0d0d12] rounded-[14px] flex items-center justify-center font-display font-black text-sm text-[#00ff88]">
                LA
              </div>
            </div>
            <h2 className="text-xl font-display font-black uppercase text-white tracking-tight mt-3">LearnApp</h2>
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest text-center">Goals & Incentives Portal</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Enter Your Email</label>
              <input
                type="email"
                placeholder="email@learnapp.com"
                value={loginEmail}
                onChange={(e) => {
                  setLoginEmail(e.target.value);
                  setLoginError('');
                }}
                className="w-full bg-zinc-950/80 border border-zinc-850 rounded-xl px-4 py-3 text-white text-xs font-sans outline-none focus:border-[#00ff88] transition-all"
                required
              />
            </div>

            {loginError && (
              <p className="text-[10px] font-mono text-red-400 uppercase leading-normal">{loginError}</p>
            )}

            <button
              type="submit"
              className="w-full bg-[#00ff88]/10 hover:bg-[#00ff88]/20 border border-[#00ff88]/30 hover:border-[#00ff88]/50 text-[#00ff88] hover:text-white transition-all py-3 rounded-xl font-display font-black text-xs uppercase tracking-wide cursor-pointer active:scale-95"
            >
              Sign In
            </button>
          </form>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#ececf3] font-sans pb-16 relative">
      
      {/* Soft Elegant Blur Ambient Orbs */}
      <div className="absolute top-0 left-1/4 w-[350px] h-[350px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header Bar */}
      <div className="border-b border-zinc-900 bg-zinc-950/40 backdrop-blur-md sticky top-0 z-30 py-4 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#00ff88] to-emerald-500 p-[1.2px] shadow-[0_0_15px_rgba(0,255,136,0.15)]">
              <div className="w-full h-full bg-[#0d0d12] rounded-[7px] flex items-center justify-center font-display font-black text-xs text-[#00ff88]">
                LA
              </div>
            </div>
            <div>
              <h1 className="text-lg font-display font-black tracking-tight text-white uppercase">LearnApp</h1>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Goals & Incentives</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 justify-center">
            <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800/80 px-3 py-1.5 rounded-xl">
              <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase">Cycle:</span>
              <select
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
                className="bg-transparent text-white font-mono text-xs font-bold outline-none border-none cursor-pointer"
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0e0e12] text-white">
                    {getCycleDisplayName(c.name)}
                  </option>
                ))}
              </select>
            </div>

            {loggedInProfile && (
              <div className="flex items-center gap-2.5 bg-zinc-900/80 border border-zinc-800/80 pl-3 pr-2 py-1 rounded-xl">
                <div className="flex flex-col text-right">
                  <span className="text-[10px] font-display font-black text-white uppercase tracking-tight leading-none">{loggedInProfile.full_name}</span>
                  <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider">{loggedInProfile.department}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 mt-8">

        {/* Action Alerts */}
        {errorMsg && (
          <div className="mb-6 normal-case">
            {renderError(errorMsg, () => setErrorMsg(''))}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs font-mono uppercase rounded-xl flex items-center justify-between gap-3 animate-in fade-in">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Simple Mode Toggle Tabs */}
        <div className="flex gap-1.5 bg-zinc-950/80 p-1 rounded-xl border border-zinc-900 w-fit mb-8">
          <button
            onClick={() => setViewMode('leaderboard')}
            className={`px-4 py-2 rounded-lg font-display font-bold text-xs uppercase tracking-wide transition-all flex items-center gap-2 ${
              viewMode === 'leaderboard'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-[#00ff88]" />
            Company Leaderboard
          </button>
          <button
            onClick={() => {
              setViewMode('workspace');
              if (loggedInProfile) {
                setActiveEmployeeId(loggedInProfile.id);
                setLoggedInId(loggedInProfile.id);
              }
            }}
            className={`px-4 py-2 rounded-lg font-display font-bold text-xs uppercase tracking-wide transition-all flex items-center gap-2 ${
              viewMode === 'workspace'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-pink-500" />
            My Workspace
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* VIEW 1: COMPANY LEADERBOARD                                   */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'leaderboard' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Unified Control Bar on ONE Single Line */}
            <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-3">
              
              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto shrink-0">
                {/* Department Dropdown */}
                <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-850 px-3 py-1.5 rounded-lg shrink-0">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase font-black">Team:</span>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="bg-transparent text-white font-display text-xs font-bold outline-none border-none cursor-pointer"
                  >
                    {DEPARTMENTS.map(dept => (
                      <option key={dept} value={dept} className="bg-[#0e0e12] text-white">
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Button: No goals added yet */}
                <button
                  type="button"
                  onClick={() => setShowNoGoalsOnly(!showNoGoalsOnly)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold uppercase transition-all shrink-0 cursor-pointer ${
                    showNoGoalsOnly
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                      : 'bg-zinc-900/60 border-zinc-850 text-zinc-400 hover:text-white hover:border-zinc-700'
                  }`}
                  title={showNoGoalsOnly ? "Show all teammates" : "Filter teammates with no goals added"}
                >
                  <Filter className={`w-3.5 h-3.5 ${showNoGoalsOnly ? 'text-amber-400' : 'text-zinc-500'}`} />
                  <span>No goals added yet</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black font-mono ${
                    showNoGoalsOnly ? 'bg-amber-500/30 text-amber-200 border border-amber-400/30' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {noGoalsCount}
                  </span>
                </button>
              </div>

              {/* Spread-out Search Bar */}
              <div className="relative w-full md:w-64">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="h-3.5 w-3.5 text-zinc-500" />
                </span>
                <input
                  type="text"
                  placeholder="Search teammate or team..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-zinc-900/60 border border-zinc-850 text-white text-xs rounded-lg block w-full pl-9 pr-3 py-2 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

            </div>

            {/* Interactive Legend Bar */}
            <div className="bg-[#0e0e14] border border-zinc-900 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-sm font-display font-black text-white uppercase tracking-tight">Active Progress Roadmap</h3>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wide">Hover segments to view categories • Click row to expand goals</p>
                </div>
                                {/* Visual Chart Legend modeled after the uploaded reference */}
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-gradient-to-tr from-orange-600 to-amber-500 rounded-sm inline-block border border-orange-500/20" />
                    <span>Business Goals</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-gradient-to-tr from-fuchsia-600 to-pink-400 rounded-sm inline-block border border-fuchsia-500/20" />
                    <span>Personal Goals</span>
                  </div>
                </div>
              </div>

              {/* Stacked Chart List */}
              <div className="space-y-3 pt-2">
                {sortedLeaderboard.map((employee, index) => {
                  const totalGoals = employee.goalsCount;
                  const completedGoals = employee.goals.filter(g => g.progress_percentage === 100).length;
                  const isExpanded = expandedEmployeeId === employee.id;

                  return (
                    <div key={employee.id} className="space-y-2">
                      <div 
                        onClick={() => setExpandedEmployeeId(isExpanded ? null : employee.id)}
                        className={`group relative grid grid-cols-12 gap-4 items-center p-4 bg-[#0a0a0f] hover:bg-[#11111a] rounded-xl border ${
                          isExpanded 
                            ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(0,255,136,0.06)]' 
                            : 'border-zinc-900/80 hover:border-zinc-800'
                        } transition-all duration-200 cursor-pointer`}
                      >
                        
                        {/* COL 1: Rank & Name */}
                        <div className="col-span-12 md:col-span-3 flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-black text-xs ${
                            index === 0 ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20' :
                            index === 1 ? 'bg-zinc-300 text-black shadow-md shadow-zinc-300/20' :
                            index === 2 ? 'bg-amber-700 text-white shadow-md shadow-amber-700/20' :
                            'bg-zinc-900 text-zinc-500 border border-zinc-850'
                          }`}>
                            {index + 1}
                          </div>
                          
                          <div className="truncate">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-display font-black text-xs text-white uppercase tracking-tight group-hover:text-emerald-400 transition-colors">
                                {employee.full_name}
                              </span>
                              {loggedInProfile && employee.id === loggedInProfile.id && (
                                <span className="text-[7px] px-1 bg-pink-500/20 text-pink-400 font-mono font-bold rounded uppercase tracking-wider">You</span>
                              )}
                            </div>
                            <span className="text-[9px] font-mono text-zinc-500 uppercase font-bold">
                              {employee.department}
                            </span>
                          </div>
                        </div>

                        {/* COL 2: Horizontal Stacked Bar Chart */}
                        <div className="col-span-12 md:col-span-6 relative">
                          <div className="w-full bg-[#121218] h-7 rounded-lg overflow-hidden border border-zinc-900 relative flex items-center">
                            
                            {/* Vertical alignment grid markings */}
                            <div className="absolute inset-0 flex justify-between pointer-events-none px-[0.5px] z-10">
                              <div className="w-[1px] h-full border-l border-zinc-900/10" />
                              <div className="w-[1px] h-full border-l border-zinc-900/30" style={{ left: '25%' }} />
                              <div className="w-[1px] h-full border-l border-zinc-900/30" style={{ left: '50%' }} />
                              <div className="w-[1px] h-full border-l border-zinc-900/30" style={{ left: '75%' }} />
                              <div className="w-[1px] h-full border-l border-zinc-900/10" />
                            </div>

                             {/* Solid progress segments */}
                            <div className="h-full flex items-center w-full">
                              {/* Business Goals Segment (50%) */}
                              {employee.businessContrib > 0 && (
                                <div 
                                  style={{ width: `${employee.businessContrib}%` }}
                                  className="h-full bg-gradient-to-r from-orange-600 to-amber-500 relative border-r border-zinc-950/40"
                                  title={`Business Progress: ${Math.round(employee.bProgress)}% (Contributes ${employee.businessContrib.toFixed(1)}%)`}
                                >
                                  {/* Gloss shine to match 3D render look */}
                                  <div className="absolute inset-x-0 top-0 h-1/2 bg-white/10 pointer-events-none" />
                                </div>
                              )}

                              {/* Personal Goals Segment (50%) */}
                              {employee.personalContrib > 0 && (
                                <div 
                                  style={{ width: `${employee.personalContrib}%` }}
                                  className="h-full bg-gradient-to-r from-fuchsia-600 to-pink-400 relative border-r border-[#0e0e14]/40"
                                  title={`Personal Progress: ${Math.round(employee.pProgress)}% (Contributes ${employee.personalContrib.toFixed(1)}%)`}
                                >
                                  <div className="absolute inset-x-0 top-0 h-1/2 bg-white/10 pointer-events-none" />
                                </div>
                              )}
                            </div>

                            {/* Progress text overlay */}
                            <div className="absolute right-3 z-20">
                              <span className="text-[10px] font-mono font-black text-white bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">
                                {employee.calculatedProgress}%
                              </span>
                            </div>

                            {/* Zero helper */}
                            {employee.calculatedProgress === 0 && (
                              <span className="text-[8px] font-mono text-zinc-700 uppercase tracking-widest pl-3">zero progress</span>
                            )}
                          </div>
                        </div>

                        {/* COL 3: Interactive 5-Emoji Stamp Card */}
                        <div className="col-span-12 md:col-span-3 flex items-center justify-between gap-3">
                          
                          {/* Unlocks visual card */}
                          <div className="flex gap-1.5 bg-[#121218] p-1.5 rounded-lg border border-zinc-900 shrink-0">
                            {SMILEYS.map((sm, smIdx) => {
                              const isUnlocked = (
                                (smIdx === 0) ||
                                (smIdx === 1 && employee.calculatedProgress >= 20) ||
                                (smIdx === 2 && employee.calculatedProgress >= 45) ||
                                (smIdx === 3 && employee.calculatedProgress >= 70) ||
                                (smIdx === 4 && employee.calculatedProgress >= 95)
                              );
                              
                              return (
                                <span 
                                  key={sm.label} 
                                  className={`text-xs select-none transition-all duration-300 ${
                                    isUnlocked 
                                      ? 'opacity-100 scale-110 drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]' 
                                      : 'opacity-15 grayscale'
                                  }`}
                                  title={sm.desc}
                                >
                                  {sm.emoji}
                                </span>
                              );
                            })}
                          </div>

                           {/* Interactive Cheers Action & Count */}
                           <div className="flex items-center">
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleCheerEmployee(employee.id);
                               }}
                               className={`px-2.5 py-1.5 rounded-lg border text-orange-400 hover:text-orange-300 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                                 allCheers.some(c => c.giver_id === sessionUserId && c.receiver_id === employee.id)
                                   ? 'bg-orange-500/25 border-orange-500/60 shadow-[0_0_10px_rgba(249,115,22,0.15)]'
                                   : 'bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20 hover:border-orange-500/40'
                               }`}
                               title={allCheers.some(c => c.giver_id === sessionUserId && c.receiver_id === employee.id) ? "Remove Flame" : "Cheer Teammate!"}
                             >
                               <Flame className={`w-3.5 h-3.5 transition-transform ${
                                 allCheers.some(c => c.giver_id === sessionUserId && c.receiver_id === employee.id)
                                   ? 'fill-orange-500 text-orange-400 scale-110'
                                   : 'fill-orange-500/20 text-orange-400'
                               }`} />
                               <span className="font-mono text-xs font-black">{employee.cheersCount}</span>
                             </button>
                           </div>

                        </div>

                      </div>

                      {/* Expanded Drawer right below row */}
                      {isExpanded && (
                        <div className="bg-[#0c0c12] border-x border-b border-zinc-900 rounded-b-xl p-5 -mt-3 space-y-4 animate-in slide-in-from-top-2 duration-200">
                          
                          <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
                            <span className="text-[10px] font-mono text-zinc-500 uppercase font-black">Active Goals</span>
                            <span className="text-[9px] font-mono text-zinc-600">{completedGoals}/{totalGoals} Complete</span>
                          </div>

                          {totalGoals > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {employee.goals.map(goal => {
                                const goalSmiley = getSmileyForPercentage(goal.progress_percentage);
                                const goalProofs = proofsMap[goal.id] || [];

                                return (
                                  <div key={goal.id} className="p-4 bg-[#07070a] rounded-xl border border-zinc-900/60 text-xs space-y-3">
                                    <div className="flex justify-between items-start gap-4">
                                      <div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="goal-title text-sm text-white">{goal.title}</span>
                                          <span className={`text-[7px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide ${goalTypeBadgeClass(goal.goal_type)}`}>
                                            {goal.goal_type}
                                          </span>
                                        </div>
                                        <p className="goal-description text-zinc-400 text-[11px] mt-1">{goal.description}</p>
                                      </div>
                                      <span className="text-xl shrink-0 select-none bg-zinc-950 w-8 h-8 rounded-lg flex items-center justify-center border border-zinc-900">
                                        {goalSmiley.emoji}
                                      </span>
                                    </div>

                                    {/* Proofs */}
                                    {goalProofs.length > 0 && (
                                      <div className="pt-2 border-t border-zinc-900/40 space-y-2">
                                        <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider block">Proofs ({goalProofs.length})</span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {goalProofs.map(proof => {
                                            const isUrl = isWebUrl(proof);
                                            const isImage = !isUrl && (proof.file_type?.startsWith('image/') || proof.external_url?.startsWith('data:image/'));
                                            const isVideo = !isUrl && (proof.file_type?.startsWith('video/') || proof.external_url?.startsWith('data:video/'));
                                            const isPdf = !isUrl && (proof.file_type === 'application/pdf' || proof.external_url?.startsWith('data:application/pdf'));

                                            return (
                                              <div 
                                                key={proof.id} 
                                                onClick={() => setSelectedPreviewProof(proof)}
                                                className="bg-zinc-950/80 p-2 rounded-xl border border-zinc-900 text-[10px] font-mono text-zinc-400 flex items-center justify-between gap-3 hover:border-emerald-500/30 hover:bg-[#11111a] transition-all cursor-pointer"
                                              >
                                                <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                                  {isUrl && (
                                                    <div className="w-7 h-7 rounded bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center shrink-0">
                                                      <Globe className="w-3.5 h-3.5 text-[#00ff88]" />
                                                    </div>
                                                  )}
                                                  {isImage && (
                                                    <img src={proof.external_url || ''} className="w-7 h-7 rounded object-cover border border-zinc-800 shrink-0" alt="Thumb" referrerPolicy="no-referrer" />
                                                  )}
                                                  {isVideo && (
                                                    <div className="w-7 h-7 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                                                      <Video className="w-3.5 h-3.5 text-zinc-400" />
                                                    </div>
                                                  )}
                                                  {isPdf && (
                                                    <div className="w-7 h-7 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                                                      <FileText className="w-3.5 h-3.5 text-red-400" />
                                                    </div>
                                                  )}
                                                  {!isUrl && !isImage && !isVideo && !isPdf && (
                                                    <div className="w-7 h-7 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                                                      <FileText className="w-3.5 h-3.5 text-zinc-400" />
                                                    </div>
                                                  )}
                                                  <div className="flex flex-col truncate flex-1 min-w-0">
                                                    {isUrl ? (
                                                      <a
                                                        href={proof.external_url || '#'}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="truncate text-[#00ff88] hover:underline font-bold"
                                                        title={proof.external_url || ''}
                                                      >
                                                        {proof.external_url}
                                                      </a>
                                                    ) : (
                                                      <span className="truncate max-w-[120px]" title={proof.file_name || 'Verification'}>
                                                        {proof.file_name}
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                                <span className="text-[8px] uppercase px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-850 shrink-0">
                                                  View
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="py-6 text-center border border-dashed border-zinc-900 rounded-xl">
                              <p className="text-[10px] font-mono text-zinc-600 uppercase">No active goals</p>
                            </div>
                          )}



                        </div>
                      )}
                    </div>
                  );
                })}

                {sortedLeaderboard.length === 0 && (
                  <div className="p-8 text-center bg-[#0a0a0f] border border-dashed border-zinc-900 rounded-xl space-y-2 py-12">
                    <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center mx-auto text-zinc-500">
                      <Users className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-mono text-zinc-300 uppercase font-bold">
                      {showNoGoalsOnly ? 'All teammates in this filter have added goals!' : 'No teammates found'}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {showNoGoalsOnly ? 'Every teammate in the selected team has submitted their goals for this cycle.' : 'Try adjusting your team or search filter.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Total Stamps Axis Ruler aligned precisely with col-span-6 above */}
              <div className="grid grid-cols-12 gap-4 items-center pt-4 border-t border-zinc-900/60 text-[10px] font-mono text-zinc-500 uppercase select-none">
                <div className="col-span-12 md:col-span-3 text-right pr-2 hidden md:block font-bold">
                  Total Stamps:
                </div>
                <div className="col-span-12 md:col-span-6 relative h-6">
                  <div className="absolute inset-x-0 top-0 flex justify-between px-[0.5px]">
                    <div className="flex flex-col items-center">
                      <div className="w-[1px] h-1.5 bg-zinc-800" />
                      <span className="mt-1">0</span>
                    </div>
                    <div className="flex flex-col items-center" style={{ position: 'absolute', left: '25%', transform: 'translateX(-50%)' }}>
                      <div className="w-[1px] h-1.5 bg-zinc-800" />
                      <span className="mt-1">5</span>
                    </div>
                    <div className="flex flex-col items-center" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
                      <div className="w-[1px] h-1.5 bg-zinc-800" />
                      <span className="mt-1">10</span>
                    </div>
                    <div className="flex flex-col items-center" style={{ position: 'absolute', left: '75%', transform: 'translateX(-50%)' }}>
                      <div className="w-[1px] h-1.5 bg-zinc-800" />
                      <span className="mt-1">15</span>
                    </div>
                    <div className="flex flex-col items-center" style={{ position: 'absolute', left: '100%', transform: 'translateX(-100%)' }}>
                      <div className="w-[1px] h-1.5 bg-zinc-800" />
                      <span className="mt-1">20</span>
                    </div>
                  </div>
                </div>
                <div className="col-span-12 md:col-span-3 text-right text-[8px] tracking-wider text-zinc-600 hidden md:block uppercase font-bold">
                  ★ Gamified Unlock card
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 2: PERSONAL INTERACTIVE WORKSPACE                        */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'workspace' && loggedInProfile && (
          <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* My Workspace Header */}
              <div className="bg-[#0e0e14] border border-zinc-900 p-6 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 shadow-xl">
                <div>
                  <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[9px] font-mono font-black text-zinc-400 uppercase tracking-wide">
                    {loggedInProfile.department}
                  </span>
                  <h2 className="text-xl font-display font-black text-white mt-1.5 uppercase">{loggedInProfile.full_name}</h2>
                </div>

                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => handleOpenCreateForm('personal', loggedInProfile)}
                    className="px-3 py-1.5 bg-fuchsia-950/40 hover:bg-fuchsia-900/40 text-pink-300 font-sans font-semibold text-xs rounded-lg border border-fuchsia-500/30 transition-colors cursor-pointer"
                  >
                    + Add Personal Goal
                  </button>
                  <button
                    onClick={() => handleOpenCreateForm('business', loggedInProfile)}
                    className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-[#00ff88] font-display font-bold text-xs uppercase rounded-lg border border-emerald-900/30 transition-colors cursor-pointer"
                  >
                    + Add Business Goal
                  </button>
                </div>
              </div>

              {/* List of my goals */}
              {workspaceGoals.length > 0 ? (
                <div className="space-y-4">
                  {workspaceGoals.map(goal => {
                    const goalProofs = proofsMap[goal.id] || [];

                    return (
                      <div key={goal.id} className="bg-[#0e0e14] border border-zinc-900 p-6 rounded-xl space-y-4 hover:border-zinc-800/80 transition-all">
                        
                        {/* Top Action Row */}
                        <div className="flex justify-between items-start gap-4 pb-3 border-b border-zinc-900">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[8px] font-sans px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide ${goalTypeBadgeClass(goal.goal_type)}`}>
                                {goal.goal_type} Goal
                              </span>
                              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Proof Mandatory to Progress
                              </span>
                            </div>
                            <h3 className="goal-title text-base text-white mt-1">{goal.title}</h3>
                            <p className="goal-description text-xs text-zinc-400 mt-0.5">{goal.description}</p>
                          </div>

                          {canEditGoals && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleOpenEditForm(goal, loggedInProfile)}
                                className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-white rounded-lg border border-zinc-800 hover:border-zinc-750 cursor-pointer"
                                title="Edit Goal"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteGoal(goal.id)}
                                className="p-1.5 bg-red-950/20 hover:bg-red-900/20 text-red-400 rounded-lg border border-red-950/30 cursor-pointer"
                                title="Delete Goal"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Tactile Emoji Selection Row for immediate progress status */}
                        <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-900 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">
                              {canEditGoals ? 'Set Progress Status' : 'Goal Progress Status'}
                            </span>
                            {!canEditGoals && (
                              <span className="text-[8px] font-mono text-zinc-500 uppercase flex items-center gap-1 select-none">
                                <Lock className="w-2.5 h-2.5 text-zinc-500" /> Read-only
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-around gap-2 max-w-md">
                            {SMILEYS.map((sm, index) => {
                              const isSelected = goal.progress_percentage === [0, 25, 50, 75, 100][index];
                              return (
                                <button
                                  key={sm.label}
                                  type="button"
                                  disabled={!canEditGoals}
                                  onClick={() => canEditGoals && handleSmileyClick(goal, index, loggedInProfile)}
                                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                                    isSelected 
                                      ? 'bg-zinc-900 scale-110 border border-[#00ff88]' 
                                      : 'opacity-40 hover:opacity-100'
                                  } ${!canEditGoals ? 'cursor-default opacity-50 hover:opacity-50' : 'cursor-pointer'}`}
                                  title={sm.desc}
                                >
                                  {sm.emoji}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Proof logs */}
                        <div className="pt-3 border-t border-zinc-900/60 space-y-3">
                          <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                            <span>PROOFS OF WORK ({goalProofs.length})</span>
                            {canEditGoals && (
                              uploadingProofForGoalId !== goal.id ? (
                                <button
                                  onClick={() => setUploadingProofForGoalId(goal.id)}
                                  className="text-[#00ff88] hover:underline cursor-pointer"
                                >
                                  + Add Proof
                                </button>
                              ) : (
                                <button
                                  onClick={() => setUploadingProofForGoalId(null)}
                                  className="text-zinc-500 hover:underline cursor-pointer"
                                >
                                  Cancel
                                </button>
                              )
                            )}
                          </div>

                          {canEditGoals && uploadingProofForGoalId === goal.id && (
                          <div className="bg-zinc-950/80 p-5 rounded-xl border border-zinc-900 space-y-3 animate-in slide-in-from-top-2">
                            <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-3.5 text-[10px] space-y-1.5">
                              <p className="text-[#00ff88] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5 text-[#00ff88]" /> Proof Upload Limits & Guidelines
                              </p>
                              <ul className="text-zinc-300 space-y-1 pl-4 list-disc font-sans text-[11px] leading-snug">
                                <li><strong className="text-white">Images (JPG, PNG, WEBP):</strong> Up to <strong>5 MB</strong> max size (automatically compressed).</li>
                                <li><strong className="text-white">PDFs & Videos (MP4, MOV):</strong> Up to <strong>500 KB</strong> direct file upload limit.</li>
                                <li><strong className="text-white">For larger files or links:</strong> Attach a link (Google Drive, Loom, YouTube, Figma, Dropbox, GitHub) in the comment/reference section.</li>
                              </ul>
                            </div>

                            <div
                              onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragging(goal.id);
                              }}
                              onDragLeave={() => setIsDragging(null)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setIsDragging(null);
                                const file = e.dataTransfer.files?.[0];
                                if (file) handleFileDropOrSelect(file, goal.id);
                              }}
                              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all cursor-pointer ${
                                isDragging === goal.id
                                  ? 'border-[#00ff88] bg-emerald-500/5 scale-[0.99]'
                                  : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/60'
                              }`}
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*,video/*,application/pdf';
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (file) handleFileDropOrSelect(file, goal.id);
                                };
                                input.click();
                              }}
                            >
                              <UploadCloud className={`w-8 h-8 mb-2 transition-transform ${isDragging === goal.id ? 'scale-110 text-[#00ff88]' : 'text-zinc-500'}`} />
                              <span className="text-[11px] text-zinc-300 text-center font-medium">
                                Drag & drop file here, or <span className="text-[#00ff88] hover:underline">browse</span>
                              </span>
                              <span className="text-[9px] text-zinc-600 uppercase font-mono mt-1">supports jpg, png, mp4, pdf</span>
                            </div>

                            {proofSubmitLoading && (
                              <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-[#00ff88] uppercase tracking-wider">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Processing & Saving proof...
                              </div>
                            )}
                          </div>
                        )}

                        {goalProofs.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono text-zinc-400">
                            {goalProofs.map(proof => {
                              const isUrl = isWebUrl(proof);
                              const isImage = !isUrl && (proof.file_type?.startsWith('image/') || proof.external_url?.startsWith('data:image/'));
                              const isVideo = !isUrl && (proof.file_type?.startsWith('video/') || proof.external_url?.startsWith('data:video/'));
                              const isPdf = !isUrl && (proof.file_type === 'application/pdf' || proof.external_url?.startsWith('data:application/pdf'));

                              return (
                                <div 
                                  key={proof.id} 
                                  onClick={() => setSelectedPreviewProof(proof)}
                                  className="bg-zinc-950 p-2 rounded-xl border border-zinc-900 flex items-center justify-between gap-3 hover:border-emerald-500/30 hover:bg-[#11111a] transition-all cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                    {isUrl && (
                                      <div className="w-8 h-8 rounded-lg bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center shrink-0">
                                        <Globe className="w-4 h-4 text-[#00ff88]" />
                                      </div>
                                    )}
                                    {isImage && (
                                      <img src={proof.external_url || ''} className="w-8 h-8 rounded object-cover border border-zinc-800 shrink-0" alt="Thumb" referrerPolicy="no-referrer" />
                                    )}
                                    {isVideo && (
                                      <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                                        <Video className="w-4 h-4 text-zinc-400" />
                                      </div>
                                    )}
                                    {isPdf && (
                                      <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                                        <FileText className="w-4 h-4 text-red-400" />
                                      </div>
                                    )}
                                    {!isUrl && !isImage && !isVideo && !isPdf && (
                                      <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                                        <FileText className="w-4 h-4 text-zinc-400" />
                                      </div>
                                    )}
                                    <div className="flex flex-col truncate flex-1 min-w-0">
                                      {isUrl ? (
                                        <>
                                          <a
                                            href={proof.external_url || '#'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="truncate font-mono font-bold text-xs text-[#00ff88] hover:underline block"
                                            title={proof.external_url || ''}
                                          >
                                            {proof.external_url}
                                          </a>
                                          <span className="text-[8px] text-zinc-500 font-mono uppercase">Raw URL Link</span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="truncate font-bold text-white max-w-[130px]">{proof.file_name}</span>
                                          <span className="text-[8px] text-zinc-500">{( (proof.file_size || 0) / 1024 ).toFixed(0)} KB</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[8px] uppercase px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-850 shrink-0">
                                      View
                                    </span>
                                    {canDeleteProof(proof, goal.employee_id) && (
                                      <button
                                        type="button"
                                        onClick={(e) => handleDeleteProof(proof.id, e)}
                                        className="p-1 rounded bg-red-950/20 hover:bg-red-900/20 text-red-400 border border-red-950/30 hover:border-red-900/30 transition-colors cursor-pointer"
                                        title="Delete Proof"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center bg-zinc-950/20 rounded-xl border border-dashed border-zinc-900">
                <p className="text-xs font-mono text-zinc-500 uppercase">No active goals found in this cycle</p>
              </div>
            )}

          </div>
        )}

      </div>

      {/* Simplified pop-up modal for Goal declaration */}
      {showGoalForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowGoalForm(false)} />
          
          <div className="bg-[#0e0e14] border border-zinc-900 rounded-xl max-w-md w-full overflow-hidden shadow-2xl relative z-10 p-6 space-y-4 font-sans">
            
            <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
              <h3 className="text-base font-display font-black text-white uppercase">
                {editingGoal ? 'Edit Goal' : 'Declare Goal'}
              </h3>
              <button onClick={() => setShowGoalForm(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              
              <div>
                <label className={`block text-[10px] font-mono uppercase mb-1 ${showTitleError ? 'text-red-400' : 'text-zinc-400'}`}>Goal Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weight Loss"
                  value={goalTitle}
                  onChange={(e) => {
                    setGoalTitle(e.target.value);
                    if (e.target.value.trim()) setShowTitleError(false);
                  }}
                  className={`bg-zinc-900 text-white text-xs rounded-lg p-2.5 w-full focus:outline-none ${
                    showTitleError ? 'border border-red-500/70 ring-1 ring-red-500/30' : 'border border-zinc-850'
                  }`}
                />
                {showTitleError && (
                  <p className="text-[10px] font-mono text-red-400 mt-1">Add a goal title</p>
                )}
              </div>

              <div>
                <label className={`block text-[10px] font-mono uppercase mb-1 ${showDescriptionError ? 'text-red-400' : 'text-zinc-400'}`}>Description and Scope</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe your target outcomes..."
                  value={goalDescription}
                  onChange={(e) => {
                    setGoalDescription(e.target.value);
                    if (e.target.value.trim()) setShowDescriptionError(false);
                  }}
                  className={`bg-zinc-900 text-white text-xs rounded-lg p-2.5 w-full focus:outline-none ${
                    showDescriptionError ? 'border border-red-500/70 ring-1 ring-red-500/30' : 'border border-zinc-850'
                  }`}
                />
                {showDescriptionError && (
                  <p className="text-[10px] font-mono text-red-400 mt-1">Add description</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Goal Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGoalType('personal')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                      goalType === 'personal'
                        ? 'bg-fuchsia-950/50 text-pink-300 border-fuchsia-500/40'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    Personal
                  </button>
                  <button
                    type="button"
                    onClick={() => setGoalType('business')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                      goalType === 'business'
                        ? 'bg-emerald-950/50 text-[#00ff88] border-emerald-500/40'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    Business
                  </button>
                </div>
              </div>

            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-zinc-900">
              <button
                type="button"
                onClick={() => setShowGoalForm(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-white text-xs font-display font-bold uppercase rounded-lg border border-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveGoal}
                disabled={formSubmitLoading}
                className="px-4 py-2 bg-[#00ff88] hover:bg-[#33ff99] text-black text-xs font-display font-black uppercase rounded-lg transition-all"
              >
                {formSubmitLoading ? 'Saving...' : 'Save Goal'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Proof Preview Modal */}
      {selectedPreviewProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedPreviewProof(null)} />
          
          <div className="bg-[#0e0e14] border border-zinc-900 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl relative z-10 flex flex-col font-sans max-h-[90vh]">
            
            <div className="flex justify-between items-center p-4 border-b border-zinc-900 bg-zinc-950/50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#00ff88]" />
                <h3 className="text-sm font-display font-black text-white uppercase tracking-tight truncate max-w-[400px]">
                  {selectedPreviewProof.file_name || 'Proof File'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {canDeleteProof(selectedPreviewProof, allGoals.find(g => g.id === selectedPreviewProof.goal_id)?.employee_id) && (
                  <button
                    onClick={(e) => handleDeleteProof(selectedPreviewProof.id, e)}
                    className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/20 text-red-400 font-display font-bold text-[9px] uppercase rounded-lg border border-red-950/30 transition-all flex items-center gap-1 cursor-pointer animate-fade-in"
                    title="Delete Proof"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete Proof
                  </button>
                )}
                <button onClick={() => setSelectedPreviewProof(null)} className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-900">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-zinc-950/30 flex flex-col justify-center min-h-[300px]">
              {selectedPreviewProof.external_url ? (
                <>
                  {isWebUrl(selectedPreviewProof) ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 bg-zinc-900/60 rounded-2xl border border-zinc-800/80 space-y-5 text-center max-w-lg mx-auto w-full">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-[#00ff88]">
                        <Globe className="w-7 h-7" />
                      </div>
                      <div className="space-y-2 w-full">
                        <span className="text-[10px] font-mono font-black uppercase text-emerald-400 tracking-wider block">
                          Verification Raw URL Link
                        </span>
                        <a
                          href={selectedPreviewProof.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs font-mono text-[#00ff88] bg-black/80 border border-zinc-800 p-3 rounded-xl break-all hover:bg-zinc-900 hover:border-emerald-500/40 transition-all underline select-all"
                        >
                          {selectedPreviewProof.external_url}
                        </a>
                      </div>
                      <a
                        href={selectedPreviewProof.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 bg-[#00ff88] text-black font-mono font-black text-xs uppercase rounded-xl flex items-center gap-2 hover:bg-[#33ff99] transition-all hover:scale-105 shadow-lg shadow-emerald-950/50"
                      >
                        <ExternalLink className="w-4 h-4" /> Open Raw Link in New Tab
                      </a>
                    </div>
                  ) : (
                    <>
                      {(selectedPreviewProof.file_type?.startsWith('image/') || selectedPreviewProof.external_url.startsWith('data:image/')) && (
                        <img 
                          src={selectedPreviewProof.external_url} 
                          className="max-h-[60vh] w-auto mx-auto rounded-lg object-contain border border-zinc-800 shadow-lg" 
                          alt="Proof preview" 
                          referrerPolicy="no-referrer"
                        />
                      )}

                      {(selectedPreviewProof.file_type?.startsWith('video/') || selectedPreviewProof.external_url.startsWith('data:video/')) && (
                        <video 
                          src={selectedPreviewProof.external_url} 
                          controls 
                          className="max-h-[60vh] w-auto mx-auto rounded-lg border border-zinc-800 shadow-lg" 
                        />
                      )}

                      {(selectedPreviewProof.file_type === 'application/pdf' || selectedPreviewProof.external_url.startsWith('data:application/pdf')) && (
                        <iframe 
                          src={selectedPreviewProof.external_url} 
                          className="w-full h-[60vh] rounded-lg border border-zinc-800 shadow-lg" 
                          title="PDF preview" 
                        />
                      )}

                      {!selectedPreviewProof.file_type?.startsWith('image/') && 
                       !selectedPreviewProof.external_url.startsWith('data:image/') &&
                       !selectedPreviewProof.file_type?.startsWith('video/') && 
                       !selectedPreviewProof.external_url.startsWith('data:video/') &&
                       selectedPreviewProof.file_type !== 'application/pdf' && 
                       !selectedPreviewProof.external_url.startsWith('data:application/pdf') && (
                        <div className="flex flex-col items-center justify-center py-12 bg-zinc-900/40 rounded-xl border border-zinc-850">
                          <FileText className="w-16 h-16 text-zinc-600 mb-3 animate-pulse" />
                          <span className="text-sm text-zinc-300 font-bold mb-1">{selectedPreviewProof.file_name}</span>
                          <span className="text-xs text-zinc-500 mb-6">{selectedPreviewProof.file_type || 'Unknown Type'} ({( (selectedPreviewProof.file_size || 0) / 1024 ).toFixed(1)} KB)</span>
                          <a 
                            href={selectedPreviewProof.external_url} 
                            download={selectedPreviewProof.file_name || 'proof-file'}
                            className="px-5 py-2.5 bg-[#00ff88] text-black font-mono font-bold text-xs uppercase rounded-xl flex items-center gap-1.5 hover:bg-[#33ff99] transition-all hover:scale-105"
                          >
                            <Download className="w-4 h-4" /> Download File
                          </a>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-zinc-500 uppercase font-mono text-xs">
                  No preview available for this file format.
                </div>
              )}
            </div>

            {selectedPreviewProof.note && (
              <div className="p-4 border-t border-zinc-900 bg-zinc-950/40 text-xs text-zinc-400 font-mono italic">
                {selectedPreviewProof.note}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Progress Proof Modal */}
      {showProgressProofModal && progressProofGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowProgressProofModal(false)} />
          
          <div className="bg-[#0e0e14] border border-zinc-900 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative z-10 p-6 space-y-4 font-sans animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-900 bg-zinc-950/20 -mx-6 -mt-6 p-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00ff88]" />
                <h3 className="text-sm font-display font-black text-white uppercase tracking-tight">
                  Upload a proof to move your progress
                </h3>
              </div>
              <button onClick={() => setShowProgressProofModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wide">Goal Title</p>
              <h4 className="goal-title text-xs text-[#00ff88]">{progressProofGoal.title}</h4>
              <p className="text-xs text-zinc-400">
                You are advancing progress to <span className="font-bold text-white">{progressProofTargetPct}%</span>.
              </p>
            </div>

            {/* Error notice within modal */}
            {progressProofError && (
              <div className="normal-case">
                {renderError(progressProofError, () => setProgressProofError(''))}
              </div>
            )}

            {/* Tabs to switch Upload file vs Link */}
            <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-900">
              <button
                type="button"
                onClick={() => { setProofModalTab('upload'); setProgressProofError(''); }}
                className={`py-1.5 text-[10px] font-display font-bold uppercase rounded-md transition-all ${
                  proofModalTab === 'upload' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => { setProofModalTab('link'); setProgressProofError(''); }}
                className={`py-1.5 text-[10px] font-display font-bold uppercase rounded-md transition-all ${
                  proofModalTab === 'link' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Attach Link
              </button>
            </div>

            {/* Modal Content depending on Tab */}
            {proofModalTab === 'upload' ? (
              <div className="space-y-3">
                <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 text-[10px] space-y-1">
                  <p className="text-[#00ff88] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-[#00ff88]" /> Upload File Limits
                  </p>
                  <ul className="text-zinc-300 space-y-1 pl-4 list-disc font-sans text-[11px] leading-snug">
                    <li><strong className="text-white">Images (JPG, PNG, WEBP):</strong> Up to <strong>5 MB</strong> max size.</li>
                    <li><strong className="text-white">PDFs & Videos (MP4, MOV):</strong> Up to <strong>500 KB</strong> direct upload limit.</li>
                    <li><strong className="text-white">For larger files:</strong> Switch to the <strong>"Attach Link"</strong> tab above to attach Google Drive, Loom, YouTube, or Figma links.</li>
                  </ul>
                </div>

                <label className="block text-[10px] font-mono text-zinc-400 uppercase">Select or Drag file</label>
                
                {!progressProofFile ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        setProgressProofFile(e.dataTransfer.files[0]);
                        setProgressProofFileName(e.dataTransfer.files[0].name);
                      }
                    }}
                    className="border-2 border-dashed border-zinc-800 hover:border-[#00ff88]/30 rounded-xl p-8 text-center bg-zinc-950/30 hover:bg-zinc-950/60 transition-all cursor-pointer relative"
                  >
                    <input
                      type="file"
                      accept="image/*,video/*,application/pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setProgressProofFile(e.target.files[0]);
                          setProgressProofFileName(e.target.files[0].name);
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <UploadCloud className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                    <span className="block text-[10px] font-mono text-zinc-400 uppercase font-black">Drag or Browse</span>
                    <span className="block text-[8px] font-mono text-zinc-500 uppercase mt-1">Images auto-compressed • For large files/PDFs/Videos use Attach Link</span>
                  </div>
                ) : (
                  <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 flex items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-6 h-6 text-[#00ff88] shrink-0" />
                      <div className="truncate">
                        <p className="text-[10px] font-bold text-white truncate max-w-[200px]">{progressProofFile.name}</p>
                        <p className="text-[8px] font-mono text-zinc-500">{(progressProofFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setProgressProofFile(null); setProgressProofFileName(''); }}
                      className="text-[9px] font-mono text-red-400 hover:underline uppercase"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">External Link URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://github.com/... or https://drive.google.com/..."
                    value={progressProofExternalUrl}
                    onChange={(e) => setProgressProofExternalUrl(e.target.value)}
                    className="bg-zinc-900 border border-zinc-850 text-white text-xs rounded-lg p-2.5 w-full focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Reference Title / Name</label>
                  <input
                    type="text"
                    placeholder="e.g. GitHub Pull Request #14"
                    value={progressProofFileName}
                    onChange={(e) => setProgressProofFileName(e.target.value)}
                    className="bg-zinc-900 border border-zinc-850 text-white text-xs rounded-lg p-2.5 w-full focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Common Note/Comment */}
            <div>
              <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Comment / Note</label>
              <textarea
                rows={2}
                placeholder="What did you work on for this step?"
                value={progressProofNote}
                onChange={(e) => setProgressProofNote(e.target.value)}
                className="bg-zinc-900 border border-zinc-850 text-white text-xs rounded-lg p-2.5 w-full focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-zinc-900">
              <button
                type="button"
                onClick={() => setShowProgressProofModal(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-white text-xs font-display font-bold uppercase rounded-lg border border-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleProgressProofSubmit()}
                disabled={progressProofLoading}
                className="px-4 py-2 bg-[#00ff88] hover:bg-[#33ff99] disabled:bg-zinc-800 disabled:text-zinc-500 text-black text-xs font-display font-black uppercase rounded-lg transition-all flex items-center gap-1.5"
              >
                {progressProofLoading ? 'Uploading...' : `Verify & Advance to ${progressProofTargetPct}%`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Proof Delete Confirmation Modal */}
      {proofToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setProofToDelete(null)} />
          <div className="bg-[#0e0e14] border border-red-950/30 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl relative z-10 flex flex-col font-sans p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-display font-black text-xs uppercase tracking-wider text-white">
                Delete Proof?
              </h3>
            </div>
            
            <p className="text-[11px] text-zinc-400 leading-relaxed font-mono">
              Are you sure you want to delete this proof of work? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setProofToDelete(null)}
                className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 text-white text-[10px] font-display font-bold uppercase rounded-lg border border-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeDeleteProof(proofToDelete)}
                className="px-3.5 py-2 bg-red-950/60 hover:bg-red-900/40 text-red-400 text-[10px] font-display font-black uppercase rounded-lg border border-red-900/30 transition-all cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Goal Delete Confirmation Modal */}
      {goalToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setGoalToDelete(null)} />
          <div className="bg-[#0e0e14] border border-red-950/30 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl relative z-10 flex flex-col font-sans p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-display font-black text-xs uppercase tracking-wider text-white">
                Delete Goal?
              </h3>
            </div>
            
            <p className="text-[11px] text-zinc-400 leading-relaxed font-mono">
              Are you sure you want to delete this goal and all of its associated verification proofs? This action is permanent.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setGoalToDelete(null)}
                className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 text-white text-[10px] font-display font-bold uppercase rounded-lg border border-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeDeleteGoal(goalToDelete)}
                className="px-3.5 py-2 bg-red-950/60 hover:bg-red-900/40 text-red-400 text-[10px] font-display font-black uppercase rounded-lg border border-red-900/30 transition-all cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
