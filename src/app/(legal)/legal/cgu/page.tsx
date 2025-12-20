import Link from "next/link";
import { Button, Card, Badge } from "@/components/ui";
import TableOfContents from "@/components/legal/TableOfContents";

export default function CGUPage() {
  const sections = [
    { id: "acceptation", title: "1. Acceptance of Terms" },
    { id: "description", title: "2. Description of Service" },
    { id: "inscription", title: "3. Registration and Account" },
    { id: "propriete", title: "4. Intellectual Property" },
    { id: "donnees", title: "5. Data Collection and Use" },
    { id: "tiers", title: "6. Third-Party Services" },
    { id: "responsabilite", title: "7. Limitation of Liability" },
    { id: "modifications", title: "8. Amendments to Terms" },
    { id: "resiliation", title: "9. Termination" },
    { id: "loi", title: "10. Applicable Law" }
  ];

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header Section */}
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            General Terms and Conditions of Use
          </h1>
          <Badge variant="outline" className="text-sm">
            Last updated: September 18, 2025
          </Badge>
        </header>

        {/* Table of Contents - Always at the top */}
        <section className="mb-8">
          <Card>
            <Card.Header>
              <Card.Title className="text-lg text-foreground">Table of Contents</Card.Title>
            </Card.Header>
            <Card.Content>
              <TableOfContents sections={sections} />
            </Card.Content>
          </Card>
        </section>

        {/* Main Content */}
        <section className="max-w-4xl mx-auto">
          <Card>
            <Card.Content className="p-8">
              <div className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">

                <div className="bg-primary/10 p-6 rounded-lg border-l-4 border-primary mb-8">
                  <p className="text-foreground leading-relaxed text-lg">
                    Welcome to Notus. Please read these general terms and conditions of use carefully as they govern your use of our mobile application.
                  </p>
                </div>

                <section id="acceptation" className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                    1. Acceptance of Terms
                  </h2>
                  <div className="space-y-6">
                    <div className="bg-muted/30 p-6 rounded-lg">
                      <p className="text-foreground leading-relaxed">
                        By accessing or using Notus, you agree to be bound by these General Terms and Conditions of Use. If you do not accept these terms, please do not use our service.
                      </p>
                    </div>
                  </div>
                </section>

                <section id="description" className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                    2. Description of Service
                  </h2>
                  <div className="space-y-6">
                    <p className="text-foreground leading-relaxed">
                      Notus is a mobile application that allows users to create, manage, and organize their documents and notes in a collaborative and secure manner.
                    </p>
                  </div>
                </section>

                <section id="inscription" className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                    3. Registration and Account
                  </h2>
                  <div className="space-y-6">
                    <div className="bg-muted/30 p-6 rounded-lg">
                      <p className="text-foreground leading-relaxed">
                        To use certain features of our service, you may need to create an account. You are responsible for maintaining the confidentiality of your login information and for all activities that occur under your account.
                      </p>
                    </div>
                  </div>
                </section>

                <section id="propriete" className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                    4. Intellectual Property
                  </h2>
                  <div className="space-y-6">
                    <div className="bg-primary/5 p-4 rounded-lg border-l-4 border-primary">
                      <p className="text-foreground leading-relaxed">
                        The content, features, and availability of Notus are our exclusive property and are protected by intellectual property laws.
                      </p>
                    </div>
                  </div>
                </section>

                <section id="donnees" className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                    5. Data Collection and Use
                  </h2>
                  <div className="space-y-6">
                    <div className="bg-muted/30 p-6 rounded-lg">
                      <ul className="space-y-4">
                        <li className="flex items-start">
                          <span className="text-primary mr-3 font-bold">•</span>
                          <span className="text-foreground">
                            We collect the following personal data: last name, first name, email address, username.
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-primary mr-3 font-bold">•</span>
                          <span className="text-foreground">
                            This data is used solely to provide and improve our service. We will not sell or rent your personal information to third parties without your explicit consent, unless required by law.
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </section>

                <section id="tiers" className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                    6. Third-Party Services
                  </h2>
                  <div className="space-y-6">
                    <div className="bg-primary/5 p-4 rounded-lg border-l-4 border-primary">
                      <p className="text-foreground leading-relaxed">
                        Our service does not use any third-party services for its operation. All data remains under our exclusive control.
                      </p>
                    </div>
                  </div>
                </section>

                <section id="responsabilite" className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                    7. Limitation of Liability
                  </h2>
                  <div className="space-y-6">
                    <div className="bg-muted/30 p-6 rounded-lg">
                      <p className="text-foreground leading-relaxed">
                        Notus is provided "as is" without warranty of any kind. We do not guarantee that our service will be uninterrupted, timely, secure, or error-free.
                      </p>
                    </div>
                  </div>
                </section>

                <section id="modifications" className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                    8. Amendments to Terms
                  </h2>
                  <div className="space-y-6">
                    <p className="text-foreground leading-relaxed">
                      We reserve the right to modify these terms at any time. Changes take effect upon their publication on Notus.
                    </p>
                  </div>
                </section>

                <section id="resiliation" className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                    9. Termination
                  </h2>
                  <div className="space-y-6">
                    <div className="bg-muted/30 p-6 rounded-lg">
                      <p className="text-foreground leading-relaxed">
                        We reserve the right to terminate or restrict your access to our service, without notice, for any reason or no reason.
                      </p>
                    </div>
                  </div>
                </section>

                <section id="loi" className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                    10. Applicable Law
                  </h2>
                  <div className="space-y-6">
                    <div className="bg-primary/10 p-6 rounded-lg border-l-4 border-primary">
                      <p className="text-foreground leading-relaxed mb-4">
                        These terms are governed by French law. Any dispute relating to the interpretation or execution of these Terms of Use will be submitted to the competent courts of Paris, France.
                      </p>
                    </div>
                    
                    <div className="bg-muted/30 p-6 rounded-lg">
                      <p className="text-foreground leading-relaxed">
                        In accordance with the "Informatique et Libertés" law of January 6, 1978, as amended, and the General Data Protection Regulation (GDPR), you have a right of access, rectification, and deletion of your personal data.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </Card.Content>
          </Card>
        </section>

        {/* Footer with back button */}
        <footer className="flex justify-center mt-12">
          <Button asChild className="py-2 px-4 text-lg">
            <Link href="/">Back to Home</Link>
          </Button>
        </footer>
      </div>
    </main>
  );
}
