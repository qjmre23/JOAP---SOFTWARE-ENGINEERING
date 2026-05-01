import { Hammer, Code, Shield, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function AboutPage() {
  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
      <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-about-title">About</h1>

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-md bg-primary p-2">
                <Hammer className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg" data-testid="text-app-name">JOAP Hardware Trading</CardTitle>
                <p className="text-sm text-muted-foreground">Supplier Management System</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Version</span>
                <p className="font-medium" data-testid="text-version">1.0.0</p>
              </div>
              <div>
                <span className="text-muted-foreground">Build</span>
                <p className="font-medium">Production</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">System Description</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    A comprehensive supplier management system designed for JOAP Hardware Trading.
                    Features include inventory management, order processing, billing and payments,
                    accounting, reporting, and user management with role-based access control.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Code className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Developer</p>
                  <p className="text-sm text-muted-foreground" data-testid="text-developer">Developed by John Marwin</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Copyright</p>
                  <p className="text-sm text-muted-foreground" data-testid="text-copyright">JOAP HARDWARE. All rights reserved.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Technology Stack</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Frontend</span>
                <p className="font-medium">React + TypeScript</p>
              </div>
              <div>
                <span className="text-muted-foreground">UI Framework</span>
                <p className="font-medium">shadcn/ui + Tailwind CSS</p>
              </div>
              <div>
                <span className="text-muted-foreground">Backend</span>
                <p className="font-medium">Node.js + Express</p>
              </div>
              <div>
                <span className="text-muted-foreground">Database</span>
                <p className="font-medium">MongoDB</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
