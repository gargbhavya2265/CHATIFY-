
import { useMemo, useState } from "react";
import { Check, Forward, Search, Users, X } from "lucide-react";

function ForwardMessageModal({
  message,
  contacts = [],
  groups = [],
  onClose,
  onForward,
}) {
  const [activeTab, setActiveTab] = useState("contacts");
  const [search, setSearch] = useState("");
  const [selectedDestinations, setSelectedDestinations] = useState([]);
  const [isForwarding, setIsForwarding] = useState(false);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return contacts.filter((contact) =>
      `${contact.fullName || ""} ${contact.email || ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [contacts, search]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();

    return groups.filter((group) =>
      (group.name || "").toLowerCase().includes(query)
    );
  }, [groups, search]);

  const toggleDestination = (type, id) => {
    const key = `${type}:${id}`;

    setSelectedDestinations((current) => {
      const exists = current.some(
        (item) => `${item.type}:${item.id}` === key
      );

      if (exists) {
        return current.filter(
          (item) => `${item.type}:${item.id}` !== key
        );
      }

      if (current.length >= 20) return current;

      return [...current, { type, id }];
    });
  };

  const handleForward = async () => {
    if (!selectedDestinations.length || isForwarding) return;

    setIsForwarding(true);

    try {
      const success = await onForward(selectedDestinations);
      if (success) onClose();
    } finally {
      setIsForwarding(false);
    }
  };

  const isSelected = (type, id) =>
    selectedDestinations.some(
      (item) => item.type === type && item.id === id
    );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isForwarding) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
              <Forward className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100">
                Forward message
              </h2>
              <p className="text-xs text-slate-400">
                Select contacts or groups
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isForwarding}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-700 p-4">
          <div className="mb-3 rounded-xl border border-slate-700 bg-slate-800/70 p-3">
            {message?.text && (
              <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-slate-200">
                {message.text}
              </p>
            )}

            {message?.image && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <img
                  src={message.image}
                  alt="Message attachment"
                  className="h-12 w-12 rounded-lg object-cover"
                />
                Image attachment
              </div>
            )}

            {message?.audio?.url && (
              <p className="mt-2 text-xs text-slate-400">
                Voice message
              </p>
            )}

            {!message?.text && !message?.image && !message?.audio?.url && (
              <p className="text-sm text-slate-400">Message attachment</p>
            )}
          </div>

          <div className="flex rounded-xl bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab("contacts");
                setSearch("");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                activeTab === "contacts"
                  ? "bg-cyan-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Contacts
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("groups");
                setSearch("");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                activeTab === "groups"
                  ? "bg-cyan-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Groups
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-3">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                activeTab === "contacts"
                  ? "Search contacts..."
                  : "Search groups..."
              }
              className="w-full bg-transparent py-3 text-sm text-slate-200 outline-none placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="max-h-[310px] min-h-[150px] space-y-1 overflow-y-auto p-3">
          {activeTab === "contacts" ? (
            filteredContacts.length ? (
              filteredContacts.map((contact) => {
                const id = contact._id?.toString();
                if (!id) return null;

                const selected = isSelected("direct", id);

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleDestination("direct", id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      selected
                        ? "border-cyan-500/60 bg-cyan-500/10"
                        : "border-transparent hover:bg-slate-800"
                    }`}
                  >
                    <img
                      src={contact.profilePic || "/avatar.png"}
                      alt={contact.fullName || "User"}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-100">
                        {contact.fullName || "User"}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {contact.email}
                      </p>
                    </div>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        selected
                          ? "border-cyan-400 bg-cyan-500 text-white"
                          : "border-slate-600"
                      }`}
                    >
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                No contacts found.
              </p>
            )
          ) : filteredGroups.length ? (
            filteredGroups.map((group) => {
              const id = group._id?.toString();
              if (!id) return null;

              const selected = isSelected("group", id);

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleDestination("group", id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                    selected
                      ? "border-cyan-500/60 bg-cyan-500/10"
                      : "border-transparent hover:bg-slate-800"
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-slate-300">
                    <Users className="h-5 w-5" />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">
                    {group.name || "Group"}
                  </span>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      selected
                        ? "border-cyan-400 bg-cyan-500 text-white"
                        : "border-slate-600"
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              No groups found.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-700 p-4">
          <p className="text-xs text-slate-400">
            {selectedDestinations.length}/20 selected
          </p>
          <button
            type="button"
            onClick={handleForward}
            disabled={!selectedDestinations.length || isForwarding}
            className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Forward className="h-4 w-4" />
            {isForwarding ? "Forwarding..." : "Forward"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ForwardMessageModal;