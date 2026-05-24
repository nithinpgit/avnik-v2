import { useAppSelector } from '../../app/hooks'
import { selectKickConfirmTarget } from './participantModerationSlice'
import { useParticipantModeration } from './useParticipantModeration'
import './kickUserConfirmModal.css'

export function KickUserConfirmModal() {
  const target = useAppSelector(selectKickConfirmTarget)
  const { confirmKick, cancelKick } = useParticipantModeration()

  if (!target) return null

  return (
    <div className="kick-confirm-overlay" role="presentation" onClick={cancelKick}>
      <div
        className="kick-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kick-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="kick-confirm-title" className="kick-confirm-modal__title">
          Remove participant
        </h2>
        <p className="kick-confirm-modal__body">
          Are you sure you want to remove <strong>{target.name}</strong> from the meeting?
        </p>
        <div className="kick-confirm-modal__actions">
          <button type="button" className="kick-confirm-modal__btn kick-confirm-modal__btn--cancel" onClick={cancelKick}>
            Cancel
          </button>
          <button type="button" className="kick-confirm-modal__btn kick-confirm-modal__btn--confirm" onClick={confirmKick}>
            Remove user
          </button>
        </div>
      </div>
    </div>
  )
}
