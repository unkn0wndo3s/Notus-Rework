import Link from "next/link";
import { UserService } from "@/lib/services/UserService";
import { Button, Card, Badge } from "@/components/ui";
import { User } from "@/lib/types";
import Icon from "@/components/Icon";

export default async function AdminDashboard() {
  const userService = new UserService();
  const usersResult = await userService.getAllUsers(5, 0);
  const recentUsers: User[] = usersResult.success ? (usersResult.users || []) : [];

  return (
    <main className="space-y-6">
      <header className="text-center pt-10">
        <h1 className="text-3xl font-bold text-foreground">
          Admin Dashboard
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage your Notus application from this interface.
        </p>
      </header>

      {/* Quick Stats */}
      {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="overflow-hidden">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-primary-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-4 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted-foreground truncate">
                    Recent Users
                  </dt>
                  <dd className="text-2xl font-bold text-foreground">
                    {recentUsers.length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-primary-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-4 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted-foreground truncate">
                    System Operational
                  </dt>
                  <dd className="text-2xl font-bold text-primary">
                    Online
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-accent-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-4 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted-foreground truncate">
                    Actions Required
                  </dt>
                  <dd className="text-2xl font-bold text-foreground">
                    0
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </Card>
      </div> */}

      {/* Quick Actions */}
      <section className="max-w-4xl mx-auto">
      <Card className="bg-background">
        <Card.Header>
          <Card.Title className="text-foreground text-center">Quick Actions</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-col md:flex-row justify-center items-center gap-4">
          <Button asChild className="bg-primary w-full md:w-auto hover:bg-primary/90 text-primary-foreground py-2 px-4">
            <Link href="/admin/users">
              <Icon name="users" className="w-4 h-4 mr-2" />
              Manage Users
            </Link>
          </Button>
          <Button asChild className="bg-primary w-full md:w-auto hover:bg-primary/90 text-primary-foreground py-2 px-4">
            <Link href="/admin/stats">
              <Icon name="chartBar" className="w-4 h-4 mr-2" />
              View Statistics
            </Link>
          </Button>
          <Button asChild className="bg-primary w-full md:w-auto hover:bg-primary/90 text-primary-foreground py-2 px-4">
            <Link href="/admin/requests">
              <Icon name="alert" className="w-4 h-4 mr-2" />
              View Requests
            </Link>
          </Button>
        </Card.Content>
      </Card>
      </section>

      {/* Recent Users */}
      <section className="max-w-4xl mx-auto">
      <Card className="bg-background">
        <Card.Header>
          <div className="flex items-center justify-between">
            <Card.Title className="text-foreground text-2xl font-semibold">Recent Users</Card.Title>
            <Button variant="link" asChild className="text-primary hover:text-primary/80">
              <Link href="/admin/users">View All</Link>
            </Button>
          </div>
        </Card.Header>
        <Card.Content className="scroll-smooth">
          {recentUsers.length > 0 ? (
            <div className="overflow-x-auto scroller">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-background">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                      Registration
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {recentUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {user.first_name?.charAt(0) || ''}
                                {user.last_name?.charAt(0) || ''}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-foreground">
                              {user.first_name || ''} {user.last_name || ''}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              @{user.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          variant={
                            user.is_banned
                              ? "destructive"
                              : user.email_verified
                                ? "success"
                                : "warning"
                          }
                        >
                          {user.is_banned
                            ? "Banned"
                            : user.email_verified
                              ? "Active"
                              : "Pending"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString("en-US")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                <Icon name="users" className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                No users found.
              </p>
            </div>
          )}
        </Card.Content>
      </Card>
      </section>
    </main>
  );
}

