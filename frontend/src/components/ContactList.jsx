
import { useEffect, useMemo, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import { useAuthStore } from "../store/useAuthStore";

function ContactList() {
  const {
    getAllContacts,
    allContacts,
    setSelectedUser,
    openUserProfile,
    isUsersLoading,
  } = useChatStore();

  const { onlineUsers } = useAuthStore();
  const [search, setSearch] = useState("");

  useEffect(() => {
    getAllContacts();
  }, [getAllContacts]);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return allContacts;

    return allContacts.filter((contact) =>
      [contact.fullName, contact.username, contact.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [allContacts, search]);

  const handleProfileClick = (event, userId) => {
    event.stopPropagation();
    openUserProfile(userId);
  };

  if (isUsersLoading) return <UsersLoadingSkeleton />;

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search people..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input input-bordered w-full bg-slate-900/70 text-slate-200 border-slate-700 focus:outline-none focus:border-cyan-500"
      />

      {filteredContacts.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-6">
          {search ? "No users found." : "No users available."}
        </p>
      ) : (
        filteredContacts.map((contact) => (
          <div
            key={contact._id}
            className="bg-cyan-500/10 p-4 rounded-lg cursor-pointer hover:bg-cyan-500/20 transition-colors"
            onClick={() => setSelectedUser(contact)}
          >
            <div className="flex items-center gap-3">
              <div
                className={`avatar ${
                  onlineUsers.includes(contact._id) ? "online" : "offline"
                }`}
              >
                <button
                  type="button"
                  className="size-12 rounded-full overflow-hidden cursor-pointer"
                  onClick={(event) =>
                    handleProfileClick(event, contact._id)
                  }
                  aria-label={`View ${contact.fullName}'s profile`}
                >
                  <img
                    src={contact.profilePic || "/avatar.png"}
                    alt={contact.fullName}
                    className="size-full object-cover"
                  />
                </button>
              </div>

              <div className="min-w-0">
                <button
                  type="button"
                  className="text-slate-200 font-medium truncate text-left hover:text-cyan-400 transition-colors"
                  onClick={(event) =>
                    handleProfileClick(event, contact._id)
                  }
                >
                  {contact.fullName}
                </button>

                <p className="text-xs text-slate-400">
                  {onlineUsers.includes(contact._id) ? "Online" : "Offline"}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default ContactList;
