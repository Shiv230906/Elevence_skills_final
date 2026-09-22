import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { selectuser } from "@/feature/userSlice";
import { useTranslation } from "react-i18next";
import { Search, UserPlus, UserCheck, Clock, Users, Loader2, Check, X, UserMinus } from "lucide-react";
import { toast } from "react-toastify";
import Head from "next/head";
import Link from "next/link";

import { BACKEND_URL } from "@/config/api";

type Tab = "find" | "requests" | "friends";

interface UserResult {
  userId: string;
  name: string;
  photo: string;
  email: string;
  friendshipStatus?: "none" | "pending" | "accepted" | "sent";
  friendshipId?: string;
}

interface FriendRequest {
  _id: string;
  requester: string;
  receiver: string;
  status: string;
  createdAt: string;
  requesterName?: string;
  requesterPhoto?: string;
}

interface Friend {
  _id: string;
  friendId: string;
  since: string;
  name?: string;
  photo?: string;
}

const FriendsPage = () => {
  const { t } = useTranslation();
  const user = useSelector(selectuser);
  const [activeTab, setActiveTab] = useState<Tab>("find");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Load friends, friend requests, and sent requests when user is logged in
  useEffect(() => {
    if (user?.uid) {
      fetchFriends();
      fetchFriendRequests();
      fetchSentRequests();
    }
  }, [user?.uid]);

  // Re-fetch active tab data when switching tabs
  useEffect(() => {
    if (activeTab === "requests" && user?.uid) {
      fetchFriendRequests();
    }
    if (activeTab === "friends" && user?.uid) {
      fetchFriends();
    }
  }, [activeTab, user?.uid]);

  const fetchSentRequests = async () => {
    if (!user?.uid) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/sent/${user.uid}`);
      const data = await res.json();
      if (data.success) {
        const sentSet = new Set<string>(data.requests.map((r: any) => r.receiver));
        setSentRequests(sentSet);
      }
    } catch (err) {
      console.warn("[Friends] Could not fetch sent requests:", err);
    }
  };

  const fetchFriendRequests = async () => {
    if (!user?.uid) return;
    setRequestsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/requests/${user.uid}`);
      const data = await res.json();
      if (data.success) {
        setFriendRequests(data.requests);
      }
    } catch (err) {
      console.error("[Friends] Error fetching requests:", err);
    } finally {
      setRequestsLoading(false);
    }
  };

  const fetchFriends = async () => {
    if (!user?.uid) return;
    setFriendsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/${user.uid}`);
      const data = await res.json();
      if (data.success) {
        setFriends(data.friends);
      }
    } catch (err) {
      console.error("[Friends] Error fetching friends:", err);
    } finally {
      setFriendsLoading(false);
    }
  };

  // Search users with debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = async (q: string) => {
    if (!user?.uid) return;
    setSearchLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/search?q=${encodeURIComponent(q)}&userId=${user.uid}`);
      const data = await res.json();
      if (data.success) {
        // Enrich with friendship status
        const enriched = await Promise.all(
          data.users.map(async (u: UserResult) => {
            try {
              const statusRes = await fetch(`${BACKEND_URL}/api/friends/status/${user.uid}/${u.userId}`);
              const statusData = await statusRes.json();
              let friendshipStatus: UserResult["friendshipStatus"] = "none";
              if (statusData.status === "accepted") friendshipStatus = "accepted";
              else if (statusData.status === "pending") {
                friendshipStatus = statusData.isSender ? "sent" : "pending";
              }
              return { ...u, friendshipStatus, friendshipId: statusData.friendship?._id };
            } catch {
              return { ...u, friendshipStatus: "none" as const };
            }
          })
        );
        setSearchResults(enriched);
      }
    } catch (err) {
      console.error("[Friends] Search error:", err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendRequest = async (targetUserId: string) => {
    if (!user?.uid) { toast.error(t("publicSpace.loginRequired")); return; }
    if (user.uid === targetUserId) {
      toast.error("You cannot send a friend request to yourself.");
      return;
    }

    setProcessingIds((prev) => new Set([...prev, targetUserId]));
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: user.uid, receiverId: targetUserId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t("friends.requestSentSuccess"));
        setSentRequests((prev) => new Set([...prev, targetUserId]));
        // Update search results
        setSearchResults((prev) =>
          prev.map((u) =>
            u.userId === targetUserId
              ? { ...u, friendshipStatus: "sent", friendshipId: data.friendship._id }
              : u
          )
        );
      } else {
        toast.error(data.error || t("friends.requestFailed"));
      }
    } catch {
      toast.error(t("friends.requestFailed"));
    } finally {
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(targetUserId); return s; });
    }
  };

  const handleAccept = async (friendshipId: string, requesterName: string) => {
    if (!user?.uid) return;
    setProcessingIds((prev) => new Set([...prev, friendshipId]));
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendshipId, userId: user.uid }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t("friends.requestAccepted"));
        setFriendRequests((prev) => prev.filter((r) => r._id !== friendshipId));
      } else {
        toast.error(data.error || "Unable to accept request.");
      }
    } catch {
      toast.error("Unable to accept request.");
    } finally {
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(friendshipId); return s; });
    }
  };

  const handleReject = async (friendshipId: string) => {
    if (!user?.uid) return;
    setProcessingIds((prev) => new Set([...prev, friendshipId]));
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendshipId, userId: user.uid }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.info(t("friends.requestRejected"));
        setFriendRequests((prev) => prev.filter((r) => r._id !== friendshipId));
      } else {
        toast.error(data.error || "Unable to reject request.");
      }
    } catch {
      toast.error("Unable to reject request.");
    } finally {
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(friendshipId); return s; });
    }
  };

  const handleUnfriend = async (friendshipId: string) => {
    if (!user?.uid) return;
    if (!window.confirm("Remove this friend?")) return;
    setProcessingIds((prev) => new Set([...prev, friendshipId]));
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/${friendshipId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t("friends.unfriendSuccess"));
        setFriends((prev) => prev.filter((f) => f._id !== friendshipId));
      } else {
        toast.error(data.error || "Unable to remove friend.");
      }
    } catch {
      toast.error("Unable to remove friend.");
    } finally {
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(friendshipId); return s; });
    }
  };

  const getFriendButtonUI = (u: UserResult) => {
    const isProcessing = processingIds.has(u.userId);
    const isAlreadyFriend = u.friendshipStatus === "accepted" || friends.some((f) => f.friendId === u.userId);
    if (isAlreadyFriend) {
      return (
        <span className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-xl text-xs font-semibold">
          <UserCheck size={13} />
          {t("friends.friends")}
        </span>
      );
    }
    if (u.friendshipStatus === "sent" || sentRequests.has(u.userId)) {
      return (
        <span className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-xl text-xs font-semibold">
          <Clock size={13} />
          {t("friends.requestSent")}
        </span>
      );
    }
    return (
      <button
        onClick={() => handleSendRequest(u.userId)}
        disabled={isProcessing}
        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
      >
        {isProcessing ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
        {t("friends.addFriend")}
      </button>
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center bg-white border border-gray-200/80 rounded-2xl p-8 max-w-sm w-full shadow-sm">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={32} />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Connect with Friends</h2>
          <p className="text-sm text-gray-500 mb-6">Please log in to your account to find, add, and connect with other users.</p>
          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-xs"
          >
            Sign In to Continue
          </Link>
        </div>
      </div>
    );
  }

  const tabConfig: { key: Tab; label: string; badge?: number }[] = [
    { key: "find", label: t("friends.findPeople") },
    { key: "requests", label: t("friends.friendRequests"), badge: friendRequests.length },
    { key: "friends", label: t("friends.myFriends"), badge: friends.length },
  ];

  return (
    <>
      <Head>
        <title>{t("friends.title")} — InternArea</title>
        <meta name="description" content="Find and connect with other InternArea users." />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t("friends.title")}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {friends.length} {friends.length === 1 ? t("friends.friendCount") : t("friends.friendCountPlural")}
              </p>
            </div>
            <Link
              href="/public-space"
              className="text-sm text-blue-600 hover:underline"
            >
              ← Public Space
            </Link>
          </div>

          {/* Tab Bar */}
          <div className="flex rounded-xl bg-white border border-gray-100 shadow-sm mb-6 p-1 gap-1">
            {tabConfig.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === tab.key ? "bg-white text-blue-600" : "bg-blue-100 text-blue-700"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── FIND PEOPLE TAB ─── */}
          {activeTab === "find" && (
            <div>
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("friends.searchPlaceholder")}
                  className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm placeholder-gray-400"
                />
                {searchLoading && (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                )}
              </div>

              {searchQuery.trim().length >= 1 && !searchLoading && searchResults.length === 0 && (
                <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <Search size={32} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">{t("friends.noResults")}</p>
                </div>
              )}

              {!searchQuery.trim() && (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <Search size={36} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Search for people to connect with</p>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((u) => (
                    <div key={u.userId} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
                      <img
                        src={u.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || "U")}`}
                        alt={u.name}
                        className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                      {getFriendButtonUI(u)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── FRIEND REQUESTS TAB ─── */}
          {activeTab === "requests" && (
            <div>
              {requestsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={28} className="animate-spin text-gray-400" />
                </div>
              ) : friendRequests.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <UserPlus size={36} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">{t("friends.noRequests")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friendRequests.map((req) => (
                    <div key={req._id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
                      <img
                        src={req.requesterPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.requester)}`}
                        alt={req.requesterName || req.requester}
                        className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {req.requesterName || `User ${req.requester.slice(0, 6)}...`}
                        </p>
                        <p className="text-xs text-gray-400">Sent a friend request</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleAccept(req._id, req.requesterName || "")}
                          disabled={processingIds.has(req._id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {processingIds.has(req._id) ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          {t("friends.accept")}
                        </button>
                        <button
                          onClick={() => handleReject(req._id)}
                          disabled={processingIds.has(req._id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-50"
                        >
                          <X size={12} />
                          {t("friends.reject")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MY FRIENDS TAB ─── */}
          {activeTab === "friends" && (
            <div>
              {friendsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={28} className="animate-spin text-gray-400" />
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <Users size={36} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">{t("friends.noFriends")}</p>
                  <button
                    onClick={() => setActiveTab("find")}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    {t("friends.findPeople")}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map((f) => (
                    <div key={f._id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
                      <img
                        src={f.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.friendId)}`}
                        alt={f.name || f.friendId}
                        className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {f.name || `User ${f.friendId.slice(0, 8)}...`}
                        </p>
                        <p className="text-xs text-gray-400">
                          {t("friends.since")} {new Date(f.since).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUnfriend(f._id)}
                        disabled={processingIds.has(f._id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold hover:bg-red-50 hover:text-red-600 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {processingIds.has(f._id) ? <Loader2 size={12} className="animate-spin" /> : <UserMinus size={12} />}
                        {t("friends.unfriend")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default FriendsPage;
