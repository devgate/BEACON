import React, { Suspense } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// Lazy load the ArenaVoting component
const ArenaVoting = React.lazy(() => import('./ArenaVoting'));

// Loading fallback component
const VotingLoadingFallback = () => (
  <div className="voting-loading-fallback" role="status" aria-label="투표 컴포넌트 로딩 중">
    <div className="loading-content">
      <FontAwesomeIcon icon={faSpinner} spin className="loading-spinner" />
      <span>투표 인터페이스를 준비하고 있습니다...</span>
    </div>
  </div>
);

// Lazy Arena Voting wrapper component
const LazyArenaVoting = React.memo(({ onVote, leftModel, rightModel, disabled, votingTips, voteOptions }) => {
  return (
    <Suspense fallback={<VotingLoadingFallback />}>
      <ArenaVoting
        onVote={onVote}
        leftModel={leftModel}
        rightModel={rightModel}
        disabled={disabled}
        votingTips={votingTips}
        voteOptions={voteOptions}
      />
    </Suspense>
  );
});

// Display name for debugging
LazyArenaVoting.displayName = 'LazyArenaVoting';

export default LazyArenaVoting;