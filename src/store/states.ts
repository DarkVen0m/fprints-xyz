import type {
  Database,
  ICollectionWithBlueprintCount,
  IProfile,
} from '@/supabase';
import { supabase } from '@/supabase';
import { Session, SupabaseClient, User } from '@supabase/supabase-js';
import isMobile from 'is-mobile';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const sortOptions = ['Most recent', 'Most liked'] as const;
export type Sort = (typeof sortOptions)[number];

type LikeHistory = { id: string; at: Date; isLiked: boolean };

interface PersistedState {
  sort: Sort;
  view: 'modern' | 'classic';
  showAdvancedFilters: boolean;
}

export interface BearState extends PersistedState {
  supabase: SupabaseClient<Database>;
  session: Session | null;
  user: User | null;
  profile: IProfile | null;
  collections: ICollectionWithBlueprintCount[] | null;
  columns: number;
  likesHistory: LikeHistory[];
  blueprintCardsPerPage: number;
  removed_new_feature: string;
  showSignUpDialog: boolean;
  blueprintIdForSignUpDialog: string | null;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setProfile: (profile: IProfile | null) => void;
  setCollections: (collections: ICollectionWithBlueprintCount[] | null) => void;
  setSort: (sort: Sort) => void;
  setView: (view: 'modern' | 'classic') => void;
  setColumns: (columns: number) => void;
  setShowAdvancedFilters: (showAdvancedFilters: boolean) => void;
  setLikesHistory: (likesHistory: LikeHistory[]) => void;
  setBlueprintCardsPerPage: (blueprintCardsPerPage: number) => void;
  setRemovedNewFeature: (removedNewFeature: string) => void;
  setShowSignUpDialog: (showSignUpDialog: boolean) => void;
  setBlueprintIdForSignUpDialog: (blueprintId: string) => void;
}

const getOptimalCardsPerPage = () => {
  if (typeof window === 'undefined') return 30;
  if (isMobile({ tablet: false })) {
    return 10;
  }
  return 30;
};

export const useBearStore = create<BearState>()(
  persist(
    set => ({
      supabase,
      session: null,
      user: null,
      profile: null,
      collections: null,
      sort: sortOptions[0],
      view: 'classic',
      columns: 4,
      showAdvancedFilters: false,
      likesHistory: [],
      blueprintCardsPerPage: getOptimalCardsPerPage(),
      removed_new_feature: '',
      showSignUpDialog: false,
      blueprintIdForSignUpDialog: null,
      setSession: session => set({ session }),
      setUser: user => set({ user }),
      setProfile: profile => set({ profile }),
      setCollections: collections => set({ collections }),
      setSort: sort => set({ sort }),
      setView: view => set({ view }),
      setColumns: columns => set({ columns }),
      setShowAdvancedFilters: show => set({ showAdvancedFilters: show }),
      setLikesHistory: likesHistory => set({ likesHistory }),
      setBlueprintCardsPerPage: blueprintCardsPerPage =>
        set({ blueprintCardsPerPage }),
      setRemovedNewFeature: removedNewFeature =>
        set({ removed_new_feature: removedNewFeature }),
      setShowSignUpDialog: showSignUpDialog => set({ showSignUpDialog }),
      setBlueprintIdForSignUpDialog: blueprintId =>
        set({ blueprintIdForSignUpDialog: blueprintId }),
    }),
    {
      name: 'user-preferences',
      partialize: state => ({
        sort: state.sort,
        view: state.view,
        showAdvancedFilters: state.showAdvancedFilters,
        removed_new_feature: state.removed_new_feature,
      }),
    }
  )
);
