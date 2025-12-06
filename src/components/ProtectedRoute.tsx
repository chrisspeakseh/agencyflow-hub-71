import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserAccess = async (userId: string) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active, force_password_change")
        .eq("id", userId)
        .single();

      if (!profile?.is_active) {
        await supabase.auth.signOut();
        navigate("/auth?inactive=true");
        return false;
      }

      // Check if password change is required (skip if already on change-password page)
      if (profile?.force_password_change && location.pathname !== "/change-password") {
        navigate("/change-password");
        return false;
      }

      return true;
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session) {
          navigate("/auth");
        } else {
          // Use setTimeout to avoid deadlock
          setTimeout(async () => {
            await checkUserAccess(session.user.id);
            setLoading(false);
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
        setLoading(false);
      } else {
        await checkUserAccess(session.user.id);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return user ? <>{children}</> : null;
};

export default ProtectedRoute;
