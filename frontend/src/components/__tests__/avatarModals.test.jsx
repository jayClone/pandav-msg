import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import ProfileSettingsModal from "../ProfileSettingsModal"
import GroupAvatarModal from "../GroupAvatarModal"

// Regression test: neither modal supported closing on Escape, unlike every
// other modal in this app (FriendRequestModal.jsx already had the pattern).
// Since these are both simple, immediate-effect modals (upload/remove apply
// instantly, no draft state to lose), there's no reason Escape shouldn't
// close them like it does everywhere else.
describe("ProfileSettingsModal", () => {
  test("closes on Escape", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <ProfileSettingsModal
        isOpen={true}
        onClose={onClose}
        currentUserName="Me"
        avatar={null}
        onAvatarChange={vi.fn()}
      />
    )

    expect(screen.getByText("Profile Picture")).toBeInTheDocument()
    await user.keyboard("{Escape}")

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test("does nothing on Escape while closed", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <ProfileSettingsModal
        isOpen={false}
        onClose={onClose}
        currentUserName="Me"
        avatar={null}
        onAvatarChange={vi.fn()}
      />
    )

    await user.keyboard("{Escape}")
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe("GroupAvatarModal", () => {
  test("closes on Escape", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <GroupAvatarModal
        isOpen={true}
        onClose={onClose}
        groupId="group-1"
        groupName="Test Group"
        avatar={null}
        onAvatarChange={vi.fn()}
      />
    )

    expect(screen.getByText("Group Picture")).toBeInTheDocument()
    await user.keyboard("{Escape}")

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test("does nothing on Escape while closed", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <GroupAvatarModal
        isOpen={false}
        onClose={onClose}
        groupId="group-1"
        groupName="Test Group"
        avatar={null}
        onAvatarChange={vi.fn()}
      />
    )

    await user.keyboard("{Escape}")
    expect(onClose).not.toHaveBeenCalled()
  })
})
