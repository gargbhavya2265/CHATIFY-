
import { useEffect, useMemo, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

function GroupsList() {
  const {
    groups,
    getMyGroups,
    getAllContacts,
    allContacts,
    isGroupsLoading,
    isUsersLoading,
    setSelectedGroup,
  } = useChatStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    getMyGroups();
    getAllContacts();
  }, [getMyGroups, getAllContacts]);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return allContacts;

    return allContacts.filter((contact) =>
      [contact.fullName, contact.username, contact.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [allContacts, search]);

  const toggleMember = (userId) => {
    setSelectedMembers((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId]
    );
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();

    if (name.trim().length < 3) {
      toast.error("Group name must contain at least 3 characters");
      return;
    }

    if (name.trim().length > 50) {
      toast.error("Group name cannot exceed 50 characters");
      return;
    }

    try {
      setIsCreating(true);

      const res = await axiosInstance.post("/groups", {
        name: name.trim(),
        description: description.trim(),
        memberIds: selectedMembers,
      });

      const newGroup = res.data.group;

      useChatStore.setState((state) => ({
        groups: [
          newGroup,
          ...state.groups.filter((group) => group._id !== newGroup._id),
        ],
      }));

      setSelectedGroup(newGroup);

      setName("");
      setDescription("");
      setSearch("");
      setSelectedMembers([]);
      setShowCreateModal(false);

      toast.success("Group created successfully!");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to create group"
      );
    } finally {
      setIsCreating(false);
    }
  };

  if (isGroupsLoading) return <UsersLoadingSkeleton />;

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowCreateModal(true)}
        className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold py-3 rounded-lg transition-colors"
      >
        <span className="text-xl">+</span>
        Create Group
      </button>

      {groups.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-slate-300 font-medium">No groups yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Create a group and start connecting!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <button
              key={group._id}
              onClick={() => setSelectedGroup(group)}
              className="w-full text-left bg-cyan-500/10 p-3 rounded-lg hover:bg-cyan-500/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-cyan-500/20 flex items-center justify-center text-2xl">
                  👥
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-slate-200 font-medium truncate">
                    {group.name}
                  </h4>

                  <p className="text-xs text-slate-400 mt-1">
                    {group.members?.length || 0} members
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateGroup}
            className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-100">
                Create New Group
              </h2>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Group Name *
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter group name"
                maxLength={50}
                required
                className="input input-bordered w-full bg-slate-900 text-slate-200 border-slate-600"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Description
              </label>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this group about?"
                rows={3}
                className="textarea textarea-bordered w-full bg-slate-900 text-slate-200 border-slate-600"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-300">
                  Add Members
                </label>

                <span className="text-xs text-cyan-400">
                  {selectedMembers.length} selected
                </span>
              </div>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search people..."
                className="input input-bordered w-full bg-slate-900 text-slate-200 border-slate-600 mb-3"
              />

              <div className="max-h-48 overflow-y-auto space-y-2">
                {isUsersLoading ? (
                  <UsersLoadingSkeleton />
                ) : filteredContacts.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-4">
                    No users found.
                  </p>
                ) : (
                  filteredContacts.map((contact) => (
                    <label
                      key={contact._id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(contact._id)}
                        onChange={() => toggleMember(contact._id)}
                        className="checkbox checkbox-info checkbox-sm"
                      />

                      <img
                        src={contact.profilePic || "/avatar.png"}
                        alt={contact.fullName}
                        className="size-9 rounded-full object-cover"
                      />

                      <span className="text-sm text-slate-200">
                        {contact.fullName}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isCreating}
                className="flex-1 py-2 rounded-lg bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 disabled:opacity-50"
              >
                {isCreating ? "Creating..." : "Create Group"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default GroupsList;
