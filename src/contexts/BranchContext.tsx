import { createContext, useContext, useMemo } from 'react';

const branchIdToName: Record<string, string> = {
  '1': 'فرع الإسكندرية',
  '2': 'فرع الجيزة',
  'فرع الإسكندرية': 'فرع الإسكندرية',
  'فرع الجيزة': 'فرع الجيزة',
};

interface BranchContextValue {
  branchId: string;
  branchName: string;
}

const BranchContext = createContext<BranchContextValue | null>(null);

export function BranchProvider({
  branchId,
  children,
}: {
  branchId: string;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({
      branchId,
      branchName: branchIdToName[branchId] || branchId,
    }),
    [branchId]
  );
  return (
    <BranchContext.Provider value={value}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranchContext() {
  return useContext(BranchContext);
}
