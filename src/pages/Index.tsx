import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/config/appConfig";
import { ArrowRight, CheckCircle2, Users, FolderKanban } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/10">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              {APP_NAME}
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground">
              Professional Task Management for IT & Social Media Agencies
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")} className="gap-2">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-8 pt-12">
            <div className="space-y-2">
              <div className="flex justify-center">
                <FolderKanban className="h-12 w-12 text-accent" />
              </div>
              <h3 className="text-lg font-semibold">Kanban Boards</h3>
              <p className="text-muted-foreground text-sm">
                Visualize your workflow with intuitive drag-and-drop boards
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-center">
                <Users className="h-12 w-12 text-accent" />
              </div>
              <h3 className="text-lg font-semibold">Team Collaboration</h3>
              <p className="text-muted-foreground text-sm">
                Role-based access control for admins, managers, and staff
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-accent" />
              </div>
              <h3 className="text-lg font-semibold">Task Tracking</h3>
              <p className="text-muted-foreground text-sm">
                Monitor progress, deadlines, and blockers in real-time
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
